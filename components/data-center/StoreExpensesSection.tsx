"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Coins, Edit2, Plus, RefreshCcw, Trash2, X } from "lucide-react";
import { EmptyState, ErrorStateCard, GlassCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { StoreExpense, StoreExpenseUpsertInput } from "@/lib/types";

type ExpenseFormState = {
  name: string;
  monthly_amount: string;
  note: string;
  status: "active" | "passive" | "draft";
};

type MessageState = {
  text: string;
  tone: "success" | "error" | "info";
} | null;

const DEFAULT_FORM: ExpenseFormState = {
  name: "",
  monthly_amount: "",
  note: "",
  status: "active",
};

function normalizeStatus(status?: string | null): ExpenseFormState["status"] {
  return status === "passive" || status === "draft" ? status : "active";
}

export function StoreExpensesSection() {
  const [expenses, setExpenses] = useState<StoreExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<StoreExpense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(DEFAULT_FORM);
  const [message, setMessage] = useState<MessageState>(null);
  const [summary, setSummary] = useState({
    count: 0,
    activeCount: 0,
    totalActiveMonthlyAmount: 0,
  });

  const refreshExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/store-expenses", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Giderler yüklenemedi");
      }

      setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
      setSummary({
        count: Number(data.count ?? 0),
        activeCount: Number(data.active_count ?? 0),
        totalActiveMonthlyAmount: Number(data.total_active_monthly_amount ?? 0),
      });
      setLoadError(null);
    } catch (error) {
      console.error("Store expenses load error:", error);
      setExpenses([]);
      setSummary({ count: 0, activeCount: 0, totalActiveMonthlyAmount: 0 });
      setLoadError("Genel giderler yüklenemedi. Sunucu bağlantısı kesildi. İnternet bağlantınızı kontrol edip tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshExpenses();
  }, [refreshExpenses]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const openEditor = (expense?: StoreExpense) => {
    if (expense) {
      setEditingExpense(expense);
      setForm({
        name: expense.name,
        monthly_amount: String(expense.monthly_amount ?? 0),
        note: expense.note ?? "",
        status: normalizeStatus(expense.status),
      });
    } else {
      setEditingExpense(null);
      setForm(DEFAULT_FORM);
    }
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingExpense(null);
    setForm(DEFAULT_FORM);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setMessage({ text: "Gider adı boş olamaz.", tone: "error" });
      return;
    }

    setSaving(true);
    try {
      const payload: StoreExpenseUpsertInput = {
        name,
        monthly_amount: Number(form.monthly_amount || 0),
        note: form.note.trim() || undefined,
        status: form.status,
      };

      const response = await fetch(
        editingExpense ? `/api/store-expenses/${editingExpense.expense_id}` : "/api/store-expenses",
        {
          method: editingExpense ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Gider kaydedilemedi");
      }

      await refreshExpenses();
      closeEditor();
      setMessage({
        text: editingExpense ? "Gider güncellendi." : "Yeni gider eklendi.",
        tone: "success",
      });
    } catch (error) {
      console.error("Store expenses save error:", error);
      setMessage({ text: "Gider kaydedilemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: StoreExpense) => {
    const confirmed = window.confirm(`${expense.name} silinsin mi? Bu işlem geri alınamaz.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/store-expenses/${expense.expense_id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Gider silinemedi");
      }

      await refreshExpenses();
      setMessage({ text: "Gider silindi.", tone: "success" });
    } catch (error) {
      console.error("Store expenses delete error:", error);
      setMessage({ text: "Gider silinemedi.", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const messageClassName =
    message?.tone === "success"
      ? "border-success/20 bg-success/5 text-success"
      : message?.tone === "error"
        ? "border-danger/20 bg-danger/5 text-danger"
        : "border-info/20 bg-info/5 text-info";

  if (loading && expenses.length === 0) {
    return (
      <GlassCard className="flex h-full flex-col">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <SkeletonCard variant="circle" height={40} delayIndex={0} />
              <div className="space-y-2">
                <SkeletonCard variant="text-line" height={14} className="w-32" />
                <SkeletonCard variant="text-line" height={12} className="w-56" />
              </div>
            </div>
          </div>
          <SkeletonCard variant="card" height={44} className="w-40" delayIndex={1} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SkeletonCard variant="card" height={96} delayIndex={2} />
          <SkeletonCard variant="card" height={96} delayIndex={3} />
        </div>

        <div className="space-y-4">
          <SkeletonCard variant="card" height={64} delayIndex={4} />
          <SkeletonTable rows={5} />
        </div>
      </GlassCard>
    );
  }

  if (loadError) {
    return (
      <ErrorStateCard
        title="Genel giderler yüklenemedi"
        description={loadError}
        action={
          <button
            type="button"
            onClick={() => void refreshExpenses()}
            className="inline-flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger transition-colors duration-200 hover:bg-danger/15"
          >
            <RefreshCcw className="h-4 w-4" />
            Tekrar dene
          </button>
        }
      />
    );
  }

  return (
    <>
      <GlassCard className="flex h-full flex-col">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground">Genel Giderler</h3>
                <p className="text-sm text-muted">
                  Aylık sabit giderleri burada tut. Bu veriler net maliyet hesaplarına girer.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-black transition-colors duration-200 hover:bg-success"
          >
            <Plus className="h-4 w-4" />
            Yeni Gider Ekle
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Aktif Gider Sayısı</p>
            {loading ? (
              <SkeletonCard variant="text-line" height={24} className="mt-2 w-16" />
            ) : (
              <p className="text-2xl font-extrabold text-foreground">{summary.activeCount}</p>
            )}
            <p className="mt-1 text-[10px] text-muted">{loading ? "Veriler güncelleniyor..." : `Toplam ${summary.count} kayıt`}</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Aktif Aylık Toplam</p>
            {loading ? (
              <SkeletonCard variant="text-line" height={24} className="mt-2 w-24" />
            ) : (
              <p className="text-2xl font-extrabold text-primary">
                {formatCurrency(summary.totalActiveMonthlyAmount)}
              </p>
            )}
          </div>
        </div>

        {message && (
          <div className={cn("mb-6 rounded-2xl border px-4 py-3 text-sm", messageClassName)}>{message.text}</div>
        )}

        {expenses.length === 0 ? (
          <EmptyState
            icon={AlertCircle}
            title="Henüz kayıtlı genel gider yok"
            description="Aylık sabit giderleri ekleyerek net maliyet ve kârlılık hesabını daha doğru hale getirin."
            action={
              <button
                type="button"
                onClick={() => openEditor()}
                className="inline-flex items-center gap-2 rounded-md bg-success px-4 py-2.5 text-sm font-bold text-black transition-colors duration-200 hover:bg-success"
              >
                <Plus className="h-4 w-4" />
                İlk Gideri Ekle
              </button>
            }
            variant="inline"
            className="mx-auto max-w-md"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-container">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border/80 bg-surface-container">
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Gider Adı</th>
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted text-right">Aylık Tutar</th>
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Açıklama / Not</th>
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Durum</th>
                    <th className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {expenses.map((expense) => {
                    const status = normalizeStatus(expense.status);
                    return (
                      <tr key={expense.expense_id} className="transition-colors duration-200 hover:bg-surface-container">
                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-foreground">{expense.name}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-mono text-sm font-bold text-primary">
                            {formatCurrency(expense.monthly_amount ?? 0)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="max-w-md truncate text-sm text-muted" title={expense.note ?? ""}>
                            {expense.note ?? "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                              status === "active"
                                ? "border-success/20 bg-success/10 text-success"
                                : status === "draft"
                                  ? "border-info/20 bg-info/10 text-info"
                                  : "border-zinc-700 bg-surface-container text-muted"
                            )}
                          >
                            {status === "active" ? "Aktif" : status === "draft" ? "Taslak" : "Pasif"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditor(expense)}
                              className="action-icon-button"
                              aria-label={`${expense.name} düzenle`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(expense)}
                              disabled={saving}
                              className="action-icon-button-danger disabled:opacity-60"
                              aria-label={`${expense.name} sil`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </GlassCard>

      <div
        className={cn(
          "fixed inset-0 z-[70] bg-panel/60 backdrop-blur-sm transition-opacity duration-300",
          editorOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeEditor}
      />

      <div
        className={cn(
          "fixed right-0 top-0 z-[80] h-full w-full max-w-lg overflow-y-auto border-l border-border bg-panel shadow-[var(--shadow-card)] transition-transform duration-500 ease-out",
          editorOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Coins className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-foreground">
                    {editingExpense ? "Gideri Düzenle" : "Yeni Gider Ekle"}
                  </h4>
                  <p className="text-xs text-muted">Aylık sabit gider kaydı oluştur veya güncelle.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeEditor}
              className="rounded-xl p-2 text-muted transition-colors duration-200 hover:bg-surface-container hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form className="space-y-6" onSubmit={(event) => void handleSave(event)}>
            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Gider Adı</label>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Örn: Depo Kirası"
                className="w-full rounded-xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Aylık Tutar (TL)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.monthly_amount}
                onChange={(event) => setForm({ ...form, monthly_amount: event.target.value })}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Açıklama / Not</label>
              <textarea
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                rows={4}
                placeholder="Kısa açıklama veya muhasebe notu..."
                className="w-full rounded-xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Durum</label>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as ExpenseFormState["status"] })
                }
                className="w-full rounded-xl border border-border bg-surface-container px-4 py-3 text-sm text-foreground outline-none transition-colors duration-200 focus:border-primary/40"
              >
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
                <option value="draft">Taslak</option>
              </select>
            </div>

            <div className="rounded-2xl border border-info/10 bg-info/5 px-4 py-3">
              <p className="text-xs leading-relaxed text-info/90">
                Bu kayıtlar net maliyet motorunda sabit gider olarak kullanılır. Aktif kayıtlar hesaplamaya girer.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-bold text-foreground transition-colors duration-200 hover:bg-surface-container"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-black transition-colors duration-200 hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? "Kaydediliyor..." : editingExpense ? "Güncelle" : "Ekle"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
