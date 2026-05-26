"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, KpiCard, GlassCard, MobileCardList, WarningBadge, SkeletonCard, EmptyState } from "@/components/ui-custom/GlassComponents";
import { formatNumber } from "@/lib/formatters";
import {
  Search, TrendingUp, AlertTriangle, CheckCircle2, FileText,
  Zap, Lightbulb, ExternalLink, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SeoPayload = {
  audits: Array<{
    id: number;
    audit_type: string;
    target_type: string;
    target_label: string;
    status: string;
    overall_score: number;
    critical_issues_count: number;
    warning_issues_count: number;
    opportunities_count: number;
    missing_meta_count: number;
    schema_status: string;
    created_at: string;
  }>;
  keywordStats: {
    total: number;
    avgVolume: number;
    avgDifficulty: number;
    avgOpportunity: number;
  };
  recSummary: Array<{ status: string; count: number }>;
  products: Array<{ id: number; name: string; sku: string }>;
};

type SeoApiResponse = {
  success?: boolean;
  data?: SeoPayload;
  error?: string;
} & Partial<SeoPayload>;

function resolveSeoPayload(payload: SeoApiResponse | null): SeoPayload | null {
  if (!payload?.success) {
    return null;
  }

  const candidate = payload.data ?? payload;
  if (
    !Array.isArray(candidate.audits) ||
    !candidate.keywordStats ||
    !Array.isArray(candidate.recSummary) ||
    !Array.isArray(candidate.products)
  ) {
    return null;
  }

  return {
    audits: candidate.audits,
    keywordStats: candidate.keywordStats,
    recSummary: candidate.recSummary,
    products: candidate.products,
  };
}

export default function SeoPage() {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<SeoPayload | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/seo", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as SeoApiResponse | null;
        const nextPayload = resolveSeoPayload(data);
        if (nextPayload) setPayload(nextPayload);
      } catch (error) {
        console.error("SEO load error:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Helper functions for audit badge styling
  const scoreColor = (score: number) =>
    score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-danger";
  const scoreBg = (score: number) =>
    score >= 80 ? "bg-success/10 border-success/20" : score >= 60 ? "bg-warning/10 border-warning/20" : "bg-danger/10 border-danger/20";
  const statusLabel = (status: string) => {
    const map: Record<string, string> = { completed: "Tamamlandı", in_progress: "İşleniyor", pending: "Bekliyor", failed: "Hata" };
    return map[status] || status;
  };
  const auditTypeLabel = (t: string) => {
    const map: Record<string, string> = { product: "Ürün", category: "Kategori", page: "Sayfa", sitewide: "Site Geneli" };
    return map[t] || t;
  };

  if (loading) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="SEO alanı" title="SEO Merkezi" description="SEO verileri hazırlanıyor..." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} className="h-28" />)}
        </div>
        <SkeletonCard className="h-[500px]" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="page-shell">
        <PageHeader eyebrow="SEO alanı" title="SEO Merkezi" description="Arama ve içerik önerileri." />
        <EmptyState
          icon={Search}
          title="Henüz analiz yok"
          description="İlk analiz için bir ürün seçip başlat."
          action={
            <Link href="/veri-merkezi" className="btn-primary">
              Veri Merkezini Aç
            </Link>
          }
        />
      </div>
    );
  }

  const { audits, keywordStats, recSummary, products } = payload;

  const pendingCount = recSummary?.find((r) => r.status === "pending")?.count ?? 0;
  const completedCount = recSummary?.find((r) => r.status === "completed")?.count ?? 0;
  const appliedCount = recSummary?.find((r) => r.status === "applied")?.count ?? 0;

  return (
    <div className="page-shell">
      <PageHeader eyebrow="SEO alanı" title="SEO Merkezi" description="Ürünler için arama ve içerik önerileri." />

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KpiCard
          title="Sonuç"
          value={formatNumber(audits.length)}
          icon={FileText}
          subValue={`${formatNumber(keywordStats?.total ?? 0)} kelime`}
        />
        <KpiCard
          title="Puan"
          value={audits.length > 0 ? `${Math.round(audits.reduce((s, a) => s + (a.overall_score || 0), 0) / audits.length)}/100` : "—"}
          icon={Target}
          trend={audits.filter((a) => a.critical_issues_count === 0).length > audits.length * 0.5 ? { value: "İyi", isPositive: true } : undefined}
        />
        <KpiCard
          title="Öneri"
          value={formatNumber(completedCount + appliedCount)}
          icon={Lightbulb}
          subValue={`${pendingCount} bekleyen`}
        />
        <KpiCard
          title="Kritik"
          value={formatNumber(audits.reduce((s, a) => s + a.critical_issues_count, 0))}
          icon={AlertTriangle}
          className={audits.reduce((s, a) => s + a.critical_issues_count, 0) > 0 ? "border-danger/20 bg-danger/5" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-6">
        {/* Keyword Stats Card */}
        <GlassCard>
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold font-heading text-foreground">
            <TrendingUp className="w-5 h-5 text-primary" />
            Kelime özeti
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <GlassCard className="p-4 sm:p-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted">Kelime</p>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(keywordStats?.total ?? 0)}</p>
            </GlassCard>
            <GlassCard className="p-4 sm:p-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted">Ortalama kullanım</p>
              <p className="text-2xl font-semibold text-foreground">{formatNumber(Math.round(keywordStats?.avgVolume ?? 0))}</p>
            </GlassCard>
            <GlassCard className="p-4 sm:p-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted">Zorluk</p>
              <p className="text-2xl font-semibold text-foreground">{Math.round(keywordStats?.avgDifficulty ?? 0)}/100</p>
            </GlassCard>
            <GlassCard className="p-4 sm:p-4">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted">Potansiyel</p>
              <p className="text-2xl font-semibold text-primary">{Math.round(keywordStats?.avgOpportunity ?? 0)}/100</p>
            </GlassCard>
          </div>
        </GlassCard>

        {/* Recommendation Summary */}
        <GlassCard>
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold font-heading text-foreground">
            <Lightbulb className="w-5 h-5 text-primary" />
            Öneriler
          </h3>
          <div className="space-y-3">
            {[
              { label: "Uygulandı", count: appliedCount, color: "bg-success", textColor: "text-success" },
              { label: "Tamamlandı", count: completedCount, color: "bg-primary", textColor: "text-primary" },
              { label: "Bekliyor", count: pendingCount, color: "bg-warning", textColor: "text-warning" },
            ].map((item) => (
              <GlassCard key={item.label} className="p-3 sm:p-3">
                <div className="flex items-center gap-3">
                  <div className={cn("w-3 h-3 rounded-full", item.color)} />
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                </div>
                <span className={cn("text-lg font-semibold", item.textColor)}>{formatNumber(item.count)}</span>
              </GlassCard>
            ))}
          </div>
        </GlassCard>

        {/* Quick Action */}
        <GlassCard>
          <h3 className="mb-6 flex items-center gap-2 text-lg font-bold font-heading text-foreground">
            <Zap className="w-5 h-5 text-primary" />
            Hızlı başlat
          </h3>
          <p className="text-xs text-muted mb-6">Başlık, açıklama ve yapı önerileri oluşturun.</p>
          <div className="space-y-2 mb-6 text-[10px] text-muted/60">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-success" /> Başlık ve açıklama</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-success" /> Giriş metni</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-success" /> Yapı verisi</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-success" /> Kelime önerileri</div>
          </div>
          <button className="btn-primary w-full">
            <Search className="w-4 h-4" />
            SEO Analizi Başlat
          </button>
          {products.length > 0 && (
            <p className="text-[10px] text-muted/60 mt-3 text-center">{products.length} ürün hazır</p>
          )}
        </GlassCard>
      </div>

      {/* Recent Audits Table */}
      <GlassCard className="mb-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">Son sonuçlar</h3>
            <p className="text-xs text-muted/60 mt-1">Son 20 analiz.</p>
          </div>
          {audits.length > 0 && (
            <WarningBadge>{audits.filter((a) => a.status === "completed").length} tamamlandı</WarningBadge>
          )}
        </div>

        {audits.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Henüz sonuç yok"
            description="İlk analizi başlatın."
            action={
              <Link href="/veri-merkezi" className="btn-primary">
                Veri Merkezini Aç
              </Link>
            }
          />
        ) : (
          <div className="hidden md:block overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hedef</th>
                  <th>Tür</th>
                  <th className="text-center">Puan</th>
                  <th className="text-center">Kritik</th>
                  <th className="text-center">Uyarı</th>
                  <th className="text-center">Fırsat</th>
                  <th>Durum</th>
                  <th className="text-right">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id}>
                    <td>
                      <p className="text-sm font-bold text-foreground">{audit.target_label}</p>
                      <p className="text-[10px] text-muted mt-0.5">{auditTypeLabel(audit.audit_type)}</p>
                    </td>
                    <td>
                      <span className="text-xs text-muted">{auditTypeLabel(audit.target_type)}</span>
                    </td>
                    <td className="text-center">
                      <span className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold border",
                        scoreBg(audit.overall_score),
                        scoreColor(audit.overall_score)
                      )}>
                        {audit.overall_score ?? "—"}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={cn("text-sm font-semibold", audit.critical_issues_count > 0 ? "text-danger" : "text-muted")}>
                        {audit.critical_issues_count}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-sm font-semibold text-warning">{audit.warning_issues_count}</span>
                    </td>
                    <td className="text-center">
                      <span className="text-sm font-semibold text-info">{audit.opportunities_count}</span>
                    </td>
                    <td>
                      <span className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] border",
                        audit.status === "completed" ? "bg-success/10 text-success border-success/20" :
                        audit.status === "in_progress" ? "bg-info/10 text-info border-info/20" :
                        "bg-muted/10 text-muted border-border"
                      )}>
                        {statusLabel(audit.status)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="text-xs text-muted">
                        {audit.created_at ? new Date(audit.created_at).toLocaleDateString("tr-TR") : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile audit cards */}
        <MobileCardList
          className="space-y-4 md:hidden"
          data={audits.slice(0, 8)}
          renderItem={(audit) => (
            <GlassCard key={audit.id} className="p-4 sm:p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{audit.target_label}</p>
                  <p className="mt-1 text-[10px] text-muted">{auditTypeLabel(audit.audit_type)} · {auditTypeLabel(audit.target_type)}</p>
                </div>
                <span className={cn(
                    "inline-flex shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold border",
                  scoreBg(audit.overall_score),
                  scoreColor(audit.overall_score)
                )}>
                  {audit.overall_score ?? "—"}/100
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <GlassCard className="p-2">
                  <p className={cn("text-lg font-semibold", audit.critical_issues_count > 0 ? "text-danger" : "text-muted")}>{audit.critical_issues_count}</p>
                  <p className="text-[8px] uppercase tracking-[0.14em] text-muted">Kritik</p>
                </GlassCard>
                <GlassCard className="p-2">
                  <p className="text-lg font-semibold text-warning">{audit.warning_issues_count}</p>
                   <p className="text-[8px] uppercase tracking-[0.14em] text-muted">Uyarı</p>
                </GlassCard>
                <GlassCard className="p-2">
                  <p className="text-lg font-semibold text-info">{audit.opportunities_count}</p>
                   <p className="text-[8px] uppercase tracking-[0.14em] text-muted">Fırsat</p>
                </GlassCard>
              </div>
            </GlassCard>
          )}
        />
      </GlassCard>

      {/* Product Selection for Quick SEO */}
      {products.length > 0 && (
        <GlassCard>
              <h3 className="mb-6 flex items-center gap-2 text-lg font-bold font-heading text-foreground">
            <ExternalLink className="w-5 h-5 text-primary" />
            Analiz için hazır ürünler
          </h3>
          <p className="text-xs text-muted mb-6">Aşağıdaki ürünler hazır. Birini seçip analizi başlatın.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.slice(0, 9).map((product) => (
              <GlassCard
                key={product.id}
                className="group flex cursor-pointer items-center gap-3 p-4 sm:p-4 transition-colors duration-200 hover:border-primary/20"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/20 transition-colors duration-200">
                  <Search className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">{product.name}</p>
                  <p className="text-[10px] text-muted truncate">{product.sku || "Kod yok"}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
