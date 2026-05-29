import Link from "next/link";
import { ArrowRight, Calculator, ShieldCheck, Sparkles } from "lucide-react";

import { formatCurrency, formatPercent } from "@/lib/formatters";
import type { ChannelCostResult } from "@/lib/types";
import type { NetCostBootstrap } from "@/lib/profit-pricing/workspace-types";
import { cn } from "@/lib/utils";

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
  const computedResults = (results ?? []).slice().sort((left, right) => right.net_profit - left.net_profit);
  const bestResult = computedResults[0] ?? null;
  const highestNetProfit = Math.max(...computedResults.map((result) => result.net_profit), 1);

  if (error) {
    return (
      <section className="rounded-[24px] border border-warning/20 bg-warning/10 px-5 py-4 text-warning">
        <p className="text-sm font-semibold">Net maliyet katmanı şu anda yanıt vermedi.</p>
        <p className="mt-2 text-sm leading-6">{error}</p>
      </section>
    );
  }

  if (!bootstrap || !selectedProduct) {
    return (
      <section className="app-surface-strong rounded-[32px] p-8">
        <span className="app-chip">Net maliyet</span>
        <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-foreground">
          Hesaplama için ürün verisi bekleniyor.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-soft">
          Ürün listesi hazır olduğunda bu yüzey, kanal bazlı net maliyet farkını gerçek değerlerle gösterecek.
        </p>
        <Link href="/net-maliyet-motoru" className="btn-primary mt-6 inline-flex px-6 py-3 text-sm">
          Sayfayı yenile
        </Link>
      </section>
    );
  }

  if (!bestResult) {
    return (
      <section className="app-surface-strong rounded-[32px] p-8">
        <span className="app-chip">Net maliyet</span>
        <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-foreground">
          Seçili ürün için sonuç üretilemedi.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-soft">
          Farklı bir ürün deneyerek veya veri merkezindeki maliyet alanlarını gözden geçirerek tekrar hesapla.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="app-surface-strong relative overflow-hidden rounded-[32px] p-7">
          <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(135deg,rgba(15,139,141,0.16),transparent_55%)]" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <span className="app-chip">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {computedResults.length} kanal analiz edildi
              </span>
              <span className="app-chip">Tek ürün · tek karar yüzeyi</span>
            </div>

            <h2 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-[3.2rem]">
              Aynı ürünün gerçek maliyeti kanala göre ne kadar değişiyor?
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-soft">
              Kargo, komisyon, vergi ve ödeme kesintisi tek tabloda birleşiyor. Bu ekranın amacı hesaplama hızını artırmak, yorum yükünü azaltmak.
            </p>

            <form action="/net-maliyet-motoru" method="get" className="mt-7 grid gap-3 lg:grid-cols-[1fr_auto]">
              <label className="space-y-2">
                <span className="ml-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Ürün seç
                </span>
                <select
                  name="productId"
                  defaultValue={selectedProductId ?? selectedProduct.id}
                  className="form-select rounded-[20px] border-slate-900/8 bg-white/90"
                >
                  {productList.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `· ${product.sku}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" className="btn-primary self-end px-6 py-3 text-sm">
                Yeniden hesapla
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InfoTile title="Ürün" value={selectedProduct.name} />
              <InfoTile title="SKU" value={selectedProduct.sku || "—"} />
              <InfoTile title="Desi" value={`${selectedProduct.desi} desi`} />
              <InfoTile
                title="Ürün + paket"
                value={formatCurrency(selectedProduct.cost + selectedProduct.packaging_cost)}
              />
            </div>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="app-surface rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="app-section-title">Kazanan kanal</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {bestResult.channel_name}
                </p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Calculator className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoTile title="Net kâr" value={formatMaybeCurrency(bestResult.net_profit)} dense />
              <InfoTile title="Marj" value={formatPercent(bestResult.profit_margin_percent ?? 0)} dense />
              <InfoTile title="Toplam maliyet" value={formatMaybeCurrency(bestResult.total_unit_cost)} dense />
              <InfoTile title="Satış fiyatı" value={formatCurrency(bestResult.sale_price)} dense />
            </div>
          </section>

          <section className="app-surface rounded-[28px] p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-base font-semibold tracking-tight text-foreground">Hızlı yorum</p>
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-soft">
              <li>
                En yüksek net kâr şu an <span className="font-semibold text-foreground">{bestResult.channel_name}</span> kanalında.
              </li>
              <li>
                En güçlü sonuç {formatPercent(bestResult.profit_margin_percent ?? 0)} marj ile geliyor.
              </li>
              <li>
                Ürün detayına geçerek bu hesaplamayı ürün geçmişi ve kanal alanlarıyla birlikte inceleyebilirsin.
              </li>
            </ul>
          </section>
        </aside>
      </section>

      <section className="app-surface rounded-[30px] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-section-title">Kanal matrisi</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
              Karşılaştırmalı maliyet görünümü
            </h3>
          </div>
          <span className="app-chip">{marketplaces.length || computedResults.length} aktif kanal</span>
        </div>

        <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-900/8">
          <div className="hidden grid-cols-[1.4fr_1fr_1fr_1fr_1fr] border-b border-slate-900/8 bg-surface-soft px-5 py-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 md:grid">
            <span>Kanal</span>
            <span>Satış</span>
            <span>Toplam maliyet</span>
            <span>Net kâr</span>
            <span>Marj</span>
          </div>

          <div className="divide-y divide-slate-900/8 bg-white/85">
            {computedResults.map((result, index) => {
              const width = result.net_profit > 0 ? Math.max(10, (result.net_profit / highestNetProfit) * 100) : 10;
              const isBest = index === 0;

              return (
                <div key={`${result.marketplace_id ?? result.channel_name}`} className="px-5 py-5">
                  <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-foreground">{result.channel_name}</p>
                        <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]", isBest ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted-foreground")}>
                          {isBest ? "En iyi" : "İzle"}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div className={cn("h-full rounded-full", isBest ? "bg-primary" : "bg-slate-900/20")} style={{ width: `${width}%` }} />
                      </div>
                    </div>
                    <MetricColumn title="Satış" value={formatCurrency(result.sale_price)} />
                    <MetricColumn title="Toplam maliyet" value={formatCurrency(result.total_unit_cost)} />
                    <MetricColumn title="Net kâr" value={formatCurrency(result.net_profit)} highlight={isBest} />
                    <MetricColumn title="Marj" value={formatPercent(result.profit_margin_percent ?? 0)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {marketplaces.length > 0 ? (
        <section className="app-surface rounded-[28px] p-6">
          <p className="app-section-title">Aktif pazar yerleri</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {marketplaces.map((marketplace) => (
              <span
                key={marketplace.id}
                className="rounded-full border border-slate-900/8 bg-white/85 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {marketplace.name}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex justify-end">
        <Link href={`/urun/${selectedProduct.id}`} className="btn-secondary px-5 py-3 text-sm">
          Ürün detayına git
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function InfoTile({
  title,
  value,
  dense = false,
}: {
  title: string;
  value: string;
  dense?: boolean;
}) {
  return (
    <div className={cn("rounded-[22px] border border-slate-900/8 bg-white/82", dense ? "px-4 py-3" : "px-4 py-4")}>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">{title}</p>
      <p className={cn("mt-2 font-semibold tracking-tight text-foreground", dense ? "text-lg" : "text-base")}>
        {value}
      </p>
    </div>
  );
}

function MetricColumn({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 md:hidden">
        {title}
      </p>
      <p className={cn("text-sm font-semibold md:text-base", highlight ? "text-primary" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}
