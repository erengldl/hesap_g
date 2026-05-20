import Link from "next/link";
import { ArrowLeft, Megaphone, Sparkles } from "lucide-react";

import { ManualAdCreateForm } from "@/components/manual-ads/ManualAdCreateForm";
import { GlassCard, PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";

export const dynamic = "force-dynamic";

export default function NewManualAdAnalysisPage() {
  return (
    <div className="page-shell">
      <PageHeader
        title="Manuel Reklam Danışmanı"
        description="Yeni manuel analiz oluştur. Kampanya verilerini gir, ardından sohbet ekranında bağlamı tamamla."
      >
        <WarningBadge>API bağlantısı yok</WarningBadge>
      </PageHeader>

      <GlassCard className="mb-6 border border-primary/20 bg-primary/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Yeni kayıt</p>
            <h2 className="mt-2 text-xl font-semibold text-foreground">Reklam analizini manuel başlat</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Bu akış sadece manuel veriyle çalışır. Kampanya kaydı oluştururken ürün seçimini veri merkezinden yaparsın;
              ciro boş bırakılırsa seçilen ürünün satış fiyatı ile sipariş sayısı üzerinden otomatik tahmin yapılır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <Megaphone className="h-3.5 w-3.5" />
              Manuel giriş
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-container px-3 py-1.5 text-xs font-semibold text-soft">
              <Sparkles className="h-3.5 w-3.5" />
              Yapay zeka açıklama
            </span>
          </div>
        </div>
      </GlassCard>

      <ManualAdCreateForm />

      <div className="mt-6">
        <Link
          href="/reklam-analizi"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-container px-4 py-2.5 text-sm font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-surface-container"
        >
          <ArrowLeft className="h-4 w-4" />
          Listeye geri dön
        </Link>
      </div>
    </div>
  );
}
