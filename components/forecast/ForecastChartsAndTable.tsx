"use client";

import { useState, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, BarChart3, FileText, Search, Table2, type LucideIcon } from "lucide-react";
import type { DemandForecastResult, ForecastRiskLevel } from "@/lib/demand-forecast-types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import { EmptyState, GlassCard, SkeletonCard, SkeletonTable } from "@/components/ui-custom/GlassComponents";

interface ForecastChartsAndTableProps {
  result: DemandForecastResult | null;
}

type SortKey = "date" | "forecast" | "revenue" | "stock";
type RiskFilter = "all" | "risk" | "safe";
type WorkspaceTab = "chart" | "table" | "notes";

export default function ForecastChartsAndTable({ result }: ForecastChartsAndTableProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chart");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [filter, setFilter] = useState<RiskFilter>("all");

  if (!result) {
    return (
      <GlassCard className="w-full space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <SkeletonCard variant="text-line" height={12} className="w-24" />
            <SkeletonCard variant="text-line" height={24} className="w-44" />
            <SkeletonCard variant="text-line" height={14} className="w-full max-w-2xl" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} variant="text-line" height={28} className="w-24" delayIndex={index} />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <SkeletonCard variant="card" height={370} delayIndex={4} />
          <SkeletonTable rows={5} />
        </div>
      </GlassCard>
    );
  }

  const tableRows = [...(result?.tableRows ?? [])]
    .filter((row) => {
      const matchesSearch = `${row.date} ${row.label}`.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "risk"
            ? row.risk_level !== "Low"
            : row.risk_level === "Low";
      return matchesSearch && matchesFilter;
    })
    .sort((left, right) => {
      switch (sortKey) {
        case "forecast":
          return right.predicted_units - left.predicted_units;
        case "revenue":
          return right.revenue - left.revenue;
        case "stock":
          return left.projected_stock - right.projected_stock;
        case "date":
        default:
          return left.date.localeCompare(right.date);
      }
    });

  const chartData = result?.chartData ?? [];
  const summary = result?.summary;
  const forecastStartDate = summary?.forecastStartDate ?? chartData.find((item) => item.is_forecast)?.date;

  return (
    <GlassCard className="w-full space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">Özet</p>
          <h2 className="text-xl font-semibold text-foreground">Grafik ve tablo</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted">Geçmiş, tahmin ve notlar aynı yerde.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <MetaPill>Tahmin modeli</MetaPill>
          <MetaPill>{summary ? `%${formatNumber(summary.wmape * 100)}` : "Belirlenmedi"}</MetaPill>
          <MetaPill>{summary ? `${summary.horizonDays} gün` : "Belirlenmedi"}</MetaPill>
          <MetaPill>{summary?.dataSource === "real" ? "Gerçek veri" : summary?.dataSource === "mixed" ? "Karma veri" : summary?.dataSource === "synthetic" ? "Sentetik veri" : "Belirlenmedi"}</MetaPill>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <TabButton active={activeTab === "chart"} icon={BarChart3} label="Grafik" onClick={() => setActiveTab("chart")} />
        <TabButton active={activeTab === "table"} icon={Table2} label="Tablo" onClick={() => setActiveTab("table")} />
        <TabButton active={activeTab === "notes"} icon={FileText} label="Notlar" onClick={() => setActiveTab("notes")} />
      </div>

      {activeTab === "chart" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
            <LegendPill color="bg-zinc-200" label="Gerçek" />
            <LegendPill color="bg-primary" label="Tahmin" />
            <LegendPill color="bg-primary/20" label="Aralık" />
      <LegendPill color="bg-surface-container" label={result?.summary?.stockWarning ?? "Stok bilgisi"} />
          </div>

          <div className="rounded-lg border border-border bg-panel/80 p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Geçmiş ve tahmin</h3>
                <p className="mt-1 text-[11px] text-muted">
                  Beyaz çizgi geçmişi, neon çizgi tahmini, bant ise aralığı gösterir.
                </p>
              </div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        Başlangıç: {forecastStartDate ?? "Belirlenmedi"}
                </div>
            </div>

            <div className="h-[390px] w-full min-w-0">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={370} minWidth={0}>
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--success)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="var(--success)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<ForecastTooltip />} />
                    {forecastStartDate ? (
                      <ReferenceLine
                        x={chartData.find((item) => item.date === forecastStartDate)?.label}
                        stroke="var(--success)"
                        strokeDasharray="4 4"
                        label={{ value: "Tahmin", position: "top", fill: "var(--success)", fontSize: 10 }}
                      />
                    ) : null}
                    <Area
                      type="monotone"
                      dataKey="lower_bound"
                      stroke="none"
                      fill="transparent"
                      stackId="forecastBand"
                      isAnimationActive={true} animationDuration={400}
                    />
                    <Area
                      type="monotone"
                      dataKey="band_span"
                      name="Aralık"
                      stroke="none"
                      fill="url(#forecastBand)"
                      fillOpacity={0.2}
                      stackId="forecastBand"
                      isAnimationActive={true} animationDuration={400}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual_units"
                      name="Gerçek"
                      stroke="var(--text-main)"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                      isAnimationActive={true} animationDuration={400}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast_units"
                      name="Tahmin"
                      stroke="var(--success)"
                      strokeWidth={3}
                      strokeDasharray="7 6"
                      dot={{ r: 3, stroke: "var(--success)", strokeWidth: 2, fill: "var(--panel-bg)" }}
                      connectNulls
                      isAnimationActive={true} animationDuration={400}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-container text-sm text-muted">
                  Grafik verisi bulunamadı.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Ufuk" value={summary ? `${summary.horizonDays} gün` : "Belirlenmedi"} />
            <MetricTile label="Veri" value={formatDataSource(summary?.dataSource)} />
            <MetricTile
              label="Güven"
              value={
                summary?.confidenceScore === "High"
                  ? "Yüksek"
                  : summary?.confidenceScore === "Medium"
                    ? "Orta"
                  : summary?.confidenceScore === "Low"
                    ? "Düşük"
                    : "Belirlenmedi"
              }
            />
          </div>
        </div>
      ) : null}

      {activeTab === "table" ? (
        <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Günlük liste</h3>
          <p className="mt-1 text-[11px] text-muted">Arama, sıralama ve filtre tek yerde.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ara..."
              className="form-input min-w-[220px] pl-10"
            />
          </div>

          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            className="form-select min-w-[140px]"
          >
            <option value="date">Tarih</option>
            <option value="forecast">Tahmin</option>
            <option value="revenue">Gelir</option>
            <option value="stock">Stok</option>
              </select>

              <div className="flex gap-2">
                {[
                  { value: "all", label: "Hepsi" },
                  { value: "risk", label: "Risk" },
                  { value: "safe", label: "Güvenli" },
                ].map((item) => {
                  const active = filter === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFilter(item.value as RiskFilter)}
                      className={cn(
                        "rounded-md border px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-surface-container text-muted hover:border-border-strong hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {tableRows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border/60 text-sm">
                <thead className="bg-surface-container">
                  <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted">
                    <Th>Tarih</Th>
                    <Th className="text-right">Tahmin</Th>
                    <Th className="text-right">Ciro</Th>
                    <Th className="text-right">Kalan stok</Th>
                    <Th className="text-right">Risk</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {tableRows.map((row) => (
                    <tr key={row.date} className="bg-surface-container">
                      <Td>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">{row.label}</p>
                          <p className="text-[10px] text-muted">{row.date}</p>
                        </div>
                      </Td>
                      <Td className="text-right font-bold text-foreground">{formatNumber(row.predicted_units)}</Td>
                      <Td className="text-right font-bold text-primary">{formatCurrency(row.revenue)}</Td>
                      <Td className="text-right font-bold text-soft">{formatNumber(row.projected_stock)}</Td>
                      <Td className="text-right">
                        <RiskBadge level={row.risk_level} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Table2}
              title="Filtreye uygun kayıt yok"
              description="Arama ya da risk filtresi nedeniyle sonuç görünmüyor. Filtreleri temizleyip tekrar deneyin."
              variant="inline"
              className="mx-auto max-w-md"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                    setSortKey("date");
                  }}
                  className="rounded-md border border-border bg-surface-container px-4 py-2 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-border-strong hover:bg-surface-container"
                >
                  Filtreleri temizle
                </button>
              }
            />
          )}
        </div>
      ) : null}

      {activeTab === "notes" ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-border bg-surface-container p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Nasıl çalışır?</h3>
                <p className="mt-1 text-[11px] text-muted">Kısa açıklama ve model davranışı.</p>
              </div>
              <MetaPill>Tahmin modeli</MetaPill>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-soft">
               {result?.methodology ?? "Yöntem bilgisi yükleniyor."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-container p-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Kısa özet</h3>
      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border/80 bg-surface-container">
                <MetricTile label="Tahmin" value={summary ? formatNumber(summary.totalForecastUnits) : "Belirlenmedi"} />
                <MetricTile label="Net kâr" value={summary ? formatCurrency(summary.expectedNetProfit) : "Belirlenmedi"} />
                <MetricTile label="Hata" value={summary ? `%${formatNumber(summary.wmape * 100)}` : "Belirlenmedi"} />
                <MetricTile label="Stok" value={summary?.stockWarning ?? "Belirtilmedi"} />
              </div>
            </div>

            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <div className="flex items-center gap-2 text-warning">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Uyarılar</p>
              </div>
              {result?.warnings?.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-soft">
                  {result.warnings.slice(0, 3).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-6 text-muted">Ek uyarı yok.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
}

function ForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null; dataKey?: string; payload?: Record<string, unknown> }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload ?? {};
  const actual = row.actual_units ?? null;
  const forecast = row.forecast_units ?? null;
  const lower = row.lower_bound ?? null;
  const upper = row.upper_bound ?? null;
  const stock = row.projected_stock ?? null;

  return (
    <div className="rounded-lg border border-primary/20 bg-panel/95 p-4 shadow-[var(--shadow-card)] backdrop-blur-xl">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{label}</p>
      <div className="space-y-2 text-xs">
        <Row label="Gerçek" value={formatMaybeNumber(actual)} />
        <Row label="Tahmin" value={formatMaybeNumber(forecast)} tone="primary" />
        <Row label="Aralık" value={`${formatMaybeNumber(lower)} - ${formatMaybeNumber(upper)}`} />
        <Row label="Kalan stok" value={formatMaybeNumber(stock)} />
      </div>
    </div>
  );
}

function formatMaybeNumber(value: unknown) {
  return value === null || value === undefined ? "-" : formatNumber(Number(value));
}

function formatDataSource(value?: string) {
  if (value === "real") return "Gerçek veri";
  if (value === "mixed") return "Karma veri";
  if (value === "synthetic") return "Sentetik veri";
  return "Belirlenmedi";
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-200",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface-container text-muted hover:border-border-strong hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-surface-container px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
      {children}
    </span>
  );
}

function LegendPill({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-container px-3 py-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}

function RiskBadge({ level }: { level: ForecastRiskLevel }) {
  const tone =
    level === "High"
      ? "border-danger/20 bg-danger/10 text-danger"
      : level === "Medium"
        ? "border-warning/20 bg-warning/10 text-warning"
        : "border-primary/20 bg-primary/10 text-primary";

  const label = level === "High" ? "Yüksek" : level === "Medium" ? "Orta" : "Düşük";

  return (
    <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]", tone)}>
      {label}
    </span>
  );
}

function Th({ children, className }: { children: ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-semibold", className)}>{children}</th>;
}

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-4 align-top", className)}>{children}</td>;
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={cn("font-semibold", tone === "primary" ? "text-primary" : "text-foreground")}>{value}</span>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-container px-3 py-3">
      <p className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
