import Link from "next/link";
import { ArrowRight, Calculator, ShieldCheck } from "lucide-react";

import { EmptyState, EyebrowBadge, GlassCard, PageHeader, WarningBadge } from "@/components/ui-custom/GlassComponents";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";
import type { NetCostBootstrap } from "@/lib/profit-pricing/workspace-types";

type NetCostWorkspaceProps = {
  bootstrap: NetCostBootstrap | null;
  results: ChannelCostResult[] | null;
  selectedProductId?: number;
  error?: string | null;
};

function formatMaybeCurrency(value: number | null | undefined) {
  return Number.isFinite(Number(value)) ? formatCurrency(Number(value ?? 0)) : "—";
}

export default function NetCostWorkspace({
  bootstrap,
  results,
  selectedProductId,
  error,
}: NetCostWorkspaceProps) {
  const selectedProduct = bootstrap?.selectedProduct ?? null;
  const productList = bootstrap?.products ?? [];
  const marketplaces = bootstrap?.marketplaces ?? [];
  const computedResults = results ?? [];
  const bestResult = [...computedResults].sort((left, right) => right.net_profit - left.net_profit)[0] ?? null;

  if (error) {
    return (
      <GlassCard className="border-warning/20 bg-warning/10">
        <p className="text-sm font-semibold text-warning">Uyarı</p>
        <p className="mt-2 text-sm leading-6 text-soft">{error}</p>
      </GlassCard>
    );
  }

  if (!bootstrap || !selectedProduct) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Net Maliyet"
          title="Net maliyet motoru"
          description="Ürün seçimi ve hesaplama verisi hazır olduğunda tek sayfada üç kanalın toplam maliyetini görürsün."
        />
        <EmptyState
          icon={Calculator}
          title="Net maliyet verisi hazır değil"
          description="Önce ürün listesinin yüklenmesi gerekiyor."
          action={(
            <Link href="/net-maliyet-motoru" className="btn-primary">
              Sayfayı yenile
            </Link>
          )}
        />
      </div>
    );
  }

  if (computedResults.length === 0 || !bestResult) {
    return (
      <div className="space-y-4">
        <PageHeader
          eyebrow="Net Maliyet"
          title="Net maliyet motoru"
          description="Seçili ürün için maliyet sonuçları henüz üretilemedi."
        />
        <EmptyState
          icon={Calculator}
          title="Sonuç yok"
          description="Ürün değiştirip yeniden hesapla; sonuçlar burada tek tablo halinde görünecek."
          action={(
            <Link href="/net-maliyet-motoru" className="btn-primary">
              Yeniden dene
            </Link>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Net Maliyet"
        title="Kanal bazlı gerçek toplam maliyet"
        description="Fiyat, kargo, komisyon, ödeme altyapısı ve vergi kesintilerini tek ekran üzerinden karşılaştır."
      >
        <EyebrowBadge variant="primary" className="gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          {computedResults.length} kanal
        </EyebrowBadge>
        <WarningBadge>Tek sayfa karar akışı</WarningBadge>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <GlassCard className="space-y-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Ürün seçimi
            </p>
            <h2 className="font-heading text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-[2rem]">
              Ürün seç, sonucu doğrudan gör
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-soft">
              Bu ekran otomatik optimizasyon üretmez; sadece net maliyet mantığını hızlı ve okunabilir biçimde gösterir.
            </p>
          </div>

          <form action="/net-maliyet-motoru" method="get" className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="space-y-2">
              <span className="ml-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Ürün seç
              </span>
              <select
                name="productId"
                defaultValue={selectedProductId ?? selectedProduct.id}
                className="form-select"
              >
                {productList.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `· ${product.sku}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn-primary self-end justify-center px-5">
              Yeniden hesapla
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Ürün</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedProduct.name}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">SKU</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedProduct.sku || "—"}</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Desi</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{selectedProduct.desi} desi</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Ürün + paketleme</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatCurrency(selectedProduct.cost + selectedProduct.packaging_cost)}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
                Sonuç özeti
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                En iyi kanal {bestResult.channel_name}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Calculator className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Net kâr</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMaybeCurrency(bestResult.net_profit)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Marj</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatPercent(bestResult.profit_margin_percent ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Toplam maliyet</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {formatMaybeCurrency(bestResult.total_unit_cost)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-surface-container px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Kanal sayısı</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{computedResults.length}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/80 bg-surface-container p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Hızlı okuma
            </p>
            <p className="mt-2 text-sm leading-6 text-soft">
              Kârlılık tablosu yalnızca temel maliyet kalemlerini gösterir. Ek optimizasyon, tahmin ve otomasyon katmanları kaldırıldı.
            </p>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Kanal karşılaştırması
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              Basit maliyet tablosu
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-soft">
              Üç kanalın satış fiyatı, toplam maliyeti, net kârı ve marjı.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/80">
          <table className="min-w-full divide-y divide-border/80 text-sm">
            <thead className="bg-surface-container/80 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              <tr>
                <th className="px-4 py-3">Kanal</th>
                <th className="px-4 py-3">Satış</th>
                <th className="px-4 py-3">Toplam maliyet</th>
                <th className="px-4 py-3">Net kâr</th>
                <th className="px-4 py-3">Marj</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80 bg-background/60">
              {computedResults.map((result) => (
                <tr key={`${result.marketplace_id ?? result.channel_name}`} className="align-top">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {result.channel_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(result.sale_price)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatCurrency(result.total_unit_cost)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {formatCurrency(result.net_profit)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatPercent(result.profit_margin_percent ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {marketplaces.length > 0 ? (
        <GlassCard className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
            Aktif kanallar
          </p>
          <div className="flex flex-wrap gap-2">
            {marketplaces.map((marketplace) => (
              <span
                key={marketplace.id}
                className="rounded-full border border-border/80 bg-surface-container px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70"
              >
                {marketplace.name}
              </span>
            ))}
          </div>
        </GlassCard>
      ) : null}

      <div className="flex justify-end">
        <Link href={`/urun/${selectedProduct.id}`} className="btn-secondary">
          Ürün detayına git
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
