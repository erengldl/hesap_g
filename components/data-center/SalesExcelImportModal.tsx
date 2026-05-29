"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";

import { formatCurrency, formatNumber } from "@/lib/formatters";
import {
  parseSalesFromExcelDetailed,
  type ExcelRowError,
  type SalesExcelParseResult,
} from "@/lib/excel";
import { cn } from "@/lib/utils";

type ToastLike = {
  text: string;
  type: "success" | "warning" | "error";
};

type SalesExcelImportModalProps = {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
  onNotify: (message: ToastLike) => void;
};

type ImportIssue = ExcelRowError & {
  stage: "parse" | "save";
};

type BulkImportResponse = {
  success?: boolean;
  count?: number;
  error?: string;
};

type ImportProgressState = {
  running: boolean;
  completed: boolean;
  current: number;
  total: number;
  success: number;
  issues: ImportIssue[];
};

const BATCH_SIZE = 50;

function resetProgressState(): ImportProgressState {
  return {
    running: false,
    completed: false,
    current: 0,
    total: 0,
    success: 0,
    issues: [],
  };
}

export function SalesExcelImportModal({
  open,
  onClose,
  onImported,
  onNotify,
}: SalesExcelImportModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<SalesExcelParseResult | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportProgressState>(resetProgressState);

  useEffect(() => {
    if (!open) {
      setIsDragging(false);
      setSelectedFile(null);
      setParsing(false);
      setParseResult(null);
      setFatalError(null);
      setImportState(resetProgressState());
    }
  }, [open]);

  const progressPercent = importState.total > 0 ? Math.min(100, Math.round((importState.current / importState.total) * 100)) : 0;
  const combinedIssues = useMemo<ImportIssue[]>(() => {
    const parseIssues = parseResult?.errors.map((issue) => ({ ...issue, stage: "parse" as const })) ?? [];
    return [...parseIssues, ...importState.issues];
  }, [importState.issues, parseResult?.errors]);

  async function handleFile(file: File) {
    const lowerName = file.name.toLocaleLowerCase("tr-TR");
    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      setFatalError("Lütfen .xlsx veya .xls uzantılı bir Excel dosyası seçin.");
      setSelectedFile(null);
      setParseResult(null);
      setImportState(resetProgressState());
      return;
    }

    setSelectedFile(file);
    setParsing(true);
    setFatalError(null);
    setImportState(resetProgressState());

    try {
      const result = await parseSalesFromExcelDetailed(file);
      setParseResult(result);
      if (result.validRows === 0) {
        setFatalError("Geçerli satış satırı bulunamadı. Dosyayı şablonla eşleştirip tekrar deneyin.");
      }
    } catch (error) {
      setParseResult(null);
      setFatalError(error instanceof Error ? error.message : "Excel dosyası okunamadı.");
    } finally {
      setParsing(false);
    }
  }

  async function handleImport() {
    if (!parseResult || parseResult.sales.length === 0 || importState.running) {
      return;
    }

    const total = parseResult.sales.length;
    let successCount = 0;
    const saveIssues: ImportIssue[] = [];

    setImportState({
      running: true,
      completed: false,
      current: 0,
      total,
      success: 0,
      issues: [],
    });

    for (let startIndex = 0; startIndex < parseResult.sales.length; startIndex += BATCH_SIZE) {
      const batch = parseResult.sales.slice(startIndex, startIndex + BATCH_SIZE);

      try {
        const response = await fetch("/api/data-center/sales-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bulk: true, items: batch }),
        });
        const data = (await response.json().catch(() => null)) as BulkImportResponse | null;

        if (!response.ok || !data?.success) {
          const fallbackMessage = data?.error ?? "Toplu kayıt sırasında beklenmeyen bir hata oluştu.";
          saveIssues.push(
            ...batch.map((sale) => ({
              rowNumber: sale.rowNumber,
              message: fallbackMessage,
              stage: "save" as const,
            }))
          );
        } else {
          successCount += Number(data.count ?? 0);
        }
      } catch (error) {
        const fallbackMessage = error instanceof Error ? error.message : "Toplu kayıt sırasında bağlantı hatası oluştu.";
        saveIssues.push(
          ...batch.map((sale) => ({
            rowNumber: sale.rowNumber,
            message: fallbackMessage,
            stage: "save" as const,
          }))
        );
      }

      const current = Math.min(startIndex + batch.length, total);
      setImportState({
        running: true,
        completed: false,
        current,
        total,
        success: successCount,
        issues: [...saveIssues],
      });

      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }

    setImportState({
      running: false,
      completed: true,
      current: total,
      total,
      success: successCount,
      issues: [...saveIssues],
    });

    if (successCount > 0) {
      await onImported();
    }

    const totalIssues = parseResult.errors.length + saveIssues.length;
    if (successCount > 0 && totalIssues === 0) {
      onNotify({ text: `${formatNumber(successCount)} satış Excel'den içe aktarıldı.`, type: "success" });
      return;
    }

    if (successCount > 0) {
      onNotify({
        text: `${formatNumber(successCount)} satış içe aktarıldı, ${formatNumber(totalIssues)} satır atlandı.`,
        type: "warning",
      });
      return;
    }

    onNotify({ text: "Geçerli satış kaydı oluşturulamadı.", type: "error" });
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-panel/60 px-4 py-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-panel shadow-[var(--shadow-card)]"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-5 sm:px-6">
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Excel satış içe aktarma</p>
                <div>
                  <h3 className="font-heading text-xl font-semibold text-foreground">Satış geçmişini yükle</h3>
                  <p className="mt-1 text-sm text-muted">
                    Dosya seçerek veya sürükleyip bırakarak satış geçmişini toplu olarak yükleyin.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={importState.running}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-container text-muted transition-colors duration-200 hover:text-foreground disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="/templates/satis_sablonu.xlsx"
                  onClick={() => {
                    // Generate templates dynamically if needed, or fallback download
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/20 hover:bg-card"
                >
                  <Download className="h-4 w-4" />
                  Format bilgisini gör
                </a>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={parsing || importState.running}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
                >
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {selectedFile ? "Dosyayı değiştir" : "Excel seç"}
                </button>
                <span className="text-xs text-muted">Desteklenen formatlar: `.xlsx`, `.xls`</span>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
              />

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                }}
                className={cn(
                  "group rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-200",
                  isDragging
                    ? "border-primary bg-primary/8"
                    : parseResult
                      ? "border-success/35 bg-success/5"
                      : "border-border/80 bg-surface-container/40 hover:border-primary/25 hover:bg-surface-container/70"
                )}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-panel/80 text-primary">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h4 className="mt-4 text-lg font-semibold text-foreground">Satış dosyasını bırakın</h4>
                <p className="mt-2 text-sm text-muted">
                  Tarih, Ürün, SKU, Kanal, Sipariş, Adet ve Birim Fiyat içeren Excel belgesini yükleyin.
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted/80">
                  {selectedFile ? `Seçili dosya: ${selectedFile.name}` : "Sürükle-bırak veya tıkla"}
                </p>
              </div>

              {fatalError ? (
                <div className="flex gap-3 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{fatalError}</p>
                </div>
              ) : null}

              {parseResult ? (
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-surface-container/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Toplam satır</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(parseResult.totalRows)}</p>
                  </div>
                  <div className="rounded-2xl border border-success/20 bg-success/10 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">Geçerli satış</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(parseResult.validRows)}</p>
                  </div>
                  <div className="rounded-2xl border border-danger/20 bg-danger/10 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-danger">Hatalı satır</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(parseResult.errors.length)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-surface-container/50 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Boş geçilen</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(parseResult.skippedRows)}</p>
                  </div>
                </div>
              ) : null}

              {(importState.running || importState.completed) && (
                <section className="rounded-3xl border border-border bg-surface-container/45 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">İlerleme durumu</p>
                      <h4 className="mt-1 text-lg font-semibold text-foreground">
                        {importState.running ? "Kayıtlar işleniyor" : "Yükleme tamamlandı"}
                      </h4>
                      <p className="mt-1 text-sm text-muted">
                        {formatNumber(importState.current)}/{formatNumber(importState.total)} satır yüklendi
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-success">Başarılı</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{formatNumber(importState.success)}</p>
                      </div>
                      <div className="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-danger">Hata</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{formatNumber(combinedIssues.length)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{progressPercent}% tamamlandı</p>
                  </div>
                </section>
              )}

              {parseResult?.preview.length ? (
                <section className="rounded-3xl border border-border/80 bg-panel/55">
                  <div className="flex items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Önizleme</p>
                      <h4 className="mt-1 text-base font-semibold text-foreground">İlk 5 satır önizleme</h4>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-border/70 text-sm">
                      <thead className="bg-surface-container/60 text-left text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        <tr>
                          <th className="px-4 py-3">Tarih</th>
                          <th className="px-4 py-3">Ürün</th>
                          <th className="px-4 py-3">Kanal</th>
                          <th className="px-4 py-3">Sipariş</th>
                          <th className="px-4 py-3 text-right">Adet</th>
                          <th className="px-4 py-3 text-right">Fiyat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {parseResult.preview.map((sale, i) => (
                          <tr key={i} className="hover:bg-surface-container/35">
                            <td className="px-4 py-3 text-muted">{sale.order_date}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{sale.product_name || "Bilinmeyen Ürün"}</div>
                              <div className="text-xs text-muted">{sale.product_sku || "Kod yok"}</div>
                            </td>
                            <td className="px-4 py-3 text-muted">{sale.marketplace_name}</td>
                            <td className="px-4 py-3 text-muted">{sale.external_order_number}</td>
                            <td className="px-4 py-3 text-right text-muted">{formatNumber(sale.quantity)}</td>
                            <td className="px-4 py-3 text-right text-muted">{formatCurrency(sale.unit_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {combinedIssues.length > 0 ? (
                <section className="rounded-3xl border border-danger/20 bg-danger/8 p-5">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-danger" />
                    <div>
                      <h4 className="text-base font-semibold text-foreground">Hatalı satırlar</h4>
                    </div>
                  </div>
                  <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {combinedIssues.map((issue, index) => (
                      <div
                        key={`${issue.stage}-${issue.rowNumber}-${index}`}
                        className="rounded-2xl border border-danger/15 bg-panel/50 px-4 py-3 text-sm text-foreground"
                      >
                        <span className="font-semibold">Satır {issue.rowNumber}</span> - {issue.field}: {issue.message}
                      </div>
                    ))}
                  </div>
                </section>
              ) : parseResult?.validRows ? (
                <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/8 p-4 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p>Şablon başarıyla doğrulandı. Yükleme yapabilirsiniz.</p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-muted">
                Satışlar veritabanına 50'li paketler halinde güvenli bir şekilde işlenir.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={importState.running}
                  className="rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-card disabled:opacity-40"
                >
                  Kapat
                </button>
                <button
                  type="button"
                  onClick={() => void handleImport()}
                  disabled={parsing || importState.running || !parseResult || parseResult.sales.length === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                  {importState.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importState.running ? "Yükleniyor..." : `Geçerli ${formatNumber(parseResult?.sales.length ?? 0)} satırı yükle`}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
