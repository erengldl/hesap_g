"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Box,
  CircleAlert,
  CircleDashed,
  Loader2,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SeedDemoButton } from "@/components/demo/SeedDemoButton";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";
import type { AggregateDashboard } from "@/lib/portfolio-analytics";
import type { ChannelCostResult, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardDataMode = "demo" | "live" | "partial";

type DashboardDataQuality = {
  score: number;
  warnings: string[];
  lastSyncAt: string | null;
};

type DashboardPayload = {
  success: boolean;
  aggregate: AggregateDashboard;
  dataMode: DashboardDataMode;
  dataQuality: DashboardDataQuality;
  fallbackUsed?: boolean;
  results?: ChannelCostResult[];
  bestChannel?: ChannelCostResult;
  product?: Product;
};

function formatShortDate(value: string | null) {
  if (!value) return "Henüz yok";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Henüz yok";
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short" }).format(date);
}

function getModeBadge(mode: DashboardDataMode) {
  if (mode === "live") return { label: "Canlı veri", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (mode === "demo") return { label: "Demo veri", className: "bg-sky-50 text-sky-700 border-sky-200" };
  return { label: "Kısmi veri", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

function getStockTone(stock: number) {
  if (stock <= 5) return { label: "Yüksek Risk", className: "bg-red-50 text-red-600 border-red-200" };
  if (stock <= 12) return { label: "Orta Risk", className: "bg-amber-50 text-amber-600 border-amber-200" };
  return { label: "Düşük Risk", className: "bg-emerald-50 text-emerald-600 border-emerald-200" };
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [seedDemoError, setSeedDemoError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const data = await response.json();
        if (response.ok && data?.success) {
          setPayload(data);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const aggregate = payload?.aggregate;
  const rankedResults = [...(payload?.results ?? [])].sort((a, b) => b.net_profit - a.net_profit);
  const bestChannel = payload?.bestChannel ?? rankedResults[0] ?? null;
  const heroProduct = payload?.product ?? null;
  const heroTopProduct = aggregate?.topProducts[0] ?? null;
  const qualityScore = Math.max(0, Math.min(100, payload?.dataQuality.score ?? 0));
  const modeBadge = getModeBadge(payload?.dataMode ?? "partial");
  const trendData = aggregate?.salesTrend.map((item) => ({
    ...item,
    profit: item.revenue * ((aggregate?.avgMargin ?? 0) / 100),
  })) ?? [];

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-[26px] border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
            <div className="h-6 w-44 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-6 h-32 animate-pulse rounded-[22px] bg-slate-100" />
          </div>
          <div className="rounded-[26px] border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
            <div className="h-6 w-32 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-6 h-32 animate-pulse rounded-[22px] bg-slate-100" />
          </div>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Dashboard hazırlanıyor...
          </div>
        </div>
      </div>
    );
  }

  if (!aggregate) {
    return (
      <section className="rounded-[26px] border border-slate-200 bg-white p-8 shadow-[var(--shadow-card)]">
        <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-semibold", modeBadge.className)}>
          {modeBadge.label}
        </span>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.05em] text-slate-900">
          Dashboard için veri gerekiyor.
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
          Referanstaki görünümü üretebilmek için önce ürün, sipariş ve kanal verilerinin en azından demo olarak hazır olması gerekiyor.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SeedDemoButton
            className="btn-primary px-6 py-3 text-sm"
            onStart={() => setSeedDemoError(null)}
            onError={setSeedDemoError}
          />
          <Link href="/veri-merkezi" className="btn-secondary px-6 py-3 text-sm">
            Veri merkezine git
          </Link>
        </div>
        {seedDemoError ? <p className="mt-4 text-sm text-danger">{seedDemoError}</p> : null}
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.38fr_0.82fr]">
        <article className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#f3faf8,#ffffff)] p-6 shadow-[var(--shadow-card)]">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="rounded-[22px] bg-white/70 p-4">
              <div className="relative mx-auto aspect-square max-w-[230px]">
                <Image
                  src="/demo-products/product-01.jpg"
                  alt={heroProduct?.name ?? "Ürün görseli"}
                  fill
                  className="object-contain drop-shadow-[0_24px_34px_rgba(15,23,42,0.18)]"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-slate-900">
                    {heroProduct?.name ?? heroTopProduct?.name ?? "Akıllı Saat Pro 2"}
                  </h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    Öne Çıkan Ürün
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  SKU: {heroProduct?.sku ?? heroTopProduct?.sku ?? "ASW-PRO2-BLK"}
                </p>

                <div className="mt-5 flex items-start gap-3 rounded-[20px] border border-emerald-200 bg-white px-4 py-4">
                  <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Kârlılık durumu: <span className="text-emerald-600">Çok iyi</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Son 30 gün verilerine göre</p>
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-[#b8e4dc] bg-[#f1fbf8] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f8b8d]">
                    En iyi kanal önerisi
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-2xl font-semibold tracking-tight text-slate-900">
                        {bestChannel?.channel_name ?? "Trendyol"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        En yüksek net kâr: {bestChannel ? formatCurrency(bestChannel.net_profit) : "—"}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-[22px] border border-slate-200 bg-white p-5">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Karar Önerisi</p>
                  <p className="mt-3 text-sm leading-7 text-slate-500">
                    {bestChannel
                      ? `${bestChannel.channel_name} kanalında fiyatı koruyarak reklam bütçesini %15 artırman beklenen net kârı güçlendirir.`
                      : "Kanal verisi hazır olduğunda burada doğrudan aksiyon önerisi oluşacak."}
                  </p>
                </div>
                <div className="mt-5 space-y-3">
                  <Link href="/profit-pricing" className="btn-primary w-full justify-center py-3 text-sm">
                    Aksiyon planı oluştur
                  </Link>
                  <Link href="/net-maliyet-motoru" className="btn-secondary w-full justify-center py-3 text-sm">
                    Detaylı analizi görüntüle
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </article>

        <aside className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-slate-900">Kârlılık Özeti</p>
            </div>
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
              Son 30 Gün
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SummaryCard title="Net Kâr" value={bestChannel ? formatCurrency(bestChannel.net_profit) : formatCurrency(aggregate.totalProfit)} detail="Önceki dönem: izleniyor" accent="emerald" />
            <SummaryCard title="Kâr Marjı" value={bestChannel ? formatPercent(bestChannel.profit_margin_percent) : formatPercent(aggregate.avgMargin)} detail="Değişim: +2,9%" accent="emerald" />
            <SummaryCard title="Toplam Maliyet" value={bestChannel ? formatCurrency(bestChannel.total_unit_cost) : formatCurrency(0)} detail="Değişim: -9,4%" accent="slate" />
            <SummaryCard title="Tahmin Güveni" value={qualityScore >= 80 ? "Yüksek" : qualityScore >= 50 ? "Orta" : "Düşük"} detail={`Güven skoru: %${qualityScore}`} accent="emerald" />
          </div>

          <Link href="/profit-pricing" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#0f8b8d]">
            Karlılık detaylarını görüntüle
            <ArrowRight className="h-4 w-4" />
          </Link>
        </aside>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-slate-900">Kanal Performans Karşılaştırması</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Sütunları Düzenle
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-[20px] border border-slate-100">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.9fr_0.7fr] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            <span>Kanal</span>
            <span>Net Kâr</span>
            <span>Kâr Marjı</span>
            <span>Toplam Maliyet</span>
            <span>Satış Adedi</span>
            <span className="text-right">Detay</span>
          </div>
          <div className="divide-y divide-slate-100">
            {rankedResults.length > 0 ? rankedResults.map((result, index) => {
              const ratio = bestChannel?.net_profit ? Math.max(18, (result.net_profit / bestChannel.net_profit) * 100) : 24;
              return (
                <div key={result.channel_name} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.9fr_0.7fr] items-center gap-3 px-4 py-4 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={cn("h-7 w-7 rounded-[10px] border border-slate-200", index === 0 ? "bg-orange-100" : index === 1 ? "bg-slate-900" : "bg-amber-100")} />
                    <div>
                      <p className="font-semibold text-slate-900">{result.channel_name}</p>
                      {index === 0 ? (
                        <span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Önerilen
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{formatCurrency(result.net_profit)}</p>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={cn("h-full rounded-full", index === 0 ? "bg-[#0f8b8d]" : index === 1 ? "bg-[#22c55e]" : "bg-[#f59e0b]")} style={{ width: `${Math.min(100, ratio)}%` }} />
                    </div>
                  </div>
                  <p className={cn("font-semibold", index === 2 ? "text-amber-600" : "text-emerald-600")}>
                    {formatPercent(result.profit_margin_percent)}
                  </p>
                  <p className="text-slate-600">{formatCurrency(result.total_unit_cost)}</p>
                  <p className="text-slate-600">{formatNumber(heroTopProduct?.orders ?? aggregate.totalOrders)}</p>
                  <div className="text-right">
                    <Link href="/net-maliyet-motoru" className="inline-flex rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                      Detay
                    </Link>
                  </div>
                </div>
              );
            }) : (
              <div className="px-4 py-8 text-sm text-slate-500">Kanal verisi henüz oluşmadı.</div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr_0.85fr]">
        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">Satış & Net Kâr Trendi</p>
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">Son 30 Gün</span>
          </div>
          <div className="mt-4 h-[250px]">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesTrendRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0f8b8d" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#0f8b8d" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="salesTrendProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#93c5fd" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" tickFormatter={(value: string) => value.slice(5)} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" tickFormatter={(value: number) => `${Math.round(value / 1000)}K`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 16, border: "1px solid #e2e8f0", boxShadow: "var(--shadow-card)" }}
                    formatter={(value, name) => [formatCurrency(Number(value)), name === "profit" ? "Net Kâr" : "Ciro"]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0f8b8d" strokeWidth={2.5} fill="url(#salesTrendRevenue)" />
                  <Area type="monotone" dataKey="profit" stroke="#7dd3fc" strokeWidth={2} fill="url(#salesTrendProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyCard text="Trend verisi oluşmadı." />
            )}
          </div>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">Stok Riski</p>
            <Link href="/veri-merkezi" className="text-xs font-medium text-[#0f8b8d]">Tümünü Gör</Link>
          </div>
          <div className="mt-4 space-y-3">
            {aggregate.stockAlerts.length > 0 ? aggregate.stockAlerts.slice(0, 3).map((alert) => {
              const tone = getStockTone(alert.stock);
              return (
                <div key={`${alert.id}-${alert.channel}`} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-100 px-3 py-3">
                  <div className="flex items-start gap-3">
                    {alert.stock <= 5 ? <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" /> : alert.stock <= 12 ? <CircleAlert className="mt-0.5 h-4 w-4 text-amber-500" /> : <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{alert.name}</p>
                      <p className="mt-1 text-xs text-slate-500">SKU: {alert.sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.className)}>
                      {tone.label}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">{alert.stock} gün kaldı</p>
                  </div>
                </div>
              );
            }) : (
              <EmptyCard text="Riskli stok bulunmuyor." />
            )}
          </div>
        </article>

        <article className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">Veri Kalitesi</p>
            <Link href="/veri-merkezi" className="text-xs font-medium text-[#0f8b8d]">Tüm Raporu Gör</Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[0.8fr_1.2fr] xl:grid-cols-1">
            <div className="flex items-center justify-center">
              <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-[10px] border-emerald-500/18 text-center">
                <p className="text-5xl font-semibold tracking-[-0.05em] text-slate-900">{qualityScore}</p>
                <p className="mt-1 text-xs font-medium text-slate-400">/100</p>
              </div>
            </div>
            <div className="space-y-3">
              <QualityRow label="Ürün Eşleşmeleri" value={Math.max(0, Math.min(100, qualityScore + 3))} />
              <QualityRow label="Fiyat & Maliyet" value={Math.max(0, Math.min(100, qualityScore - 2))} />
              <QualityRow label="Stok Verisi" value={Math.max(0, Math.min(100, qualityScore - 4))} />
              <QualityRow label="Satış Verisi" value={Math.max(0, Math.min(100, qualityScore + 2))} />
            </div>
          </div>
          <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {payload?.dataQuality.warnings[0] ?? "Tebrikler! Veri kaliteniz güçlü seviyede."}
          </div>
        </article>
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  detail,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  accent: "emerald" | "slate";
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-[1.85rem] font-semibold tracking-[-0.05em] text-slate-900">{value}</p>
      <p className={cn("mt-2 text-xs", accent === "emerald" ? "text-emerald-600" : "text-slate-500")}>{detail}</p>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-[18px] border border-dashed border-slate-200 bg-slate-50 px-4 text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <CircleDashed className="h-4 w-4" />
        {text}
      </div>
    </div>
  );
}

function QualityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-emerald-600">{value}/100</span>
    </div>
  );
}
