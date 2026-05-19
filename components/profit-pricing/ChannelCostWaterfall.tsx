"use client";

import { useEffect, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { GlassCard } from "@/components/ui-custom/GlassComponents";
import {
  formatProfitPricingCurrency,
  formatProfitPricingPercent,
} from "@/lib/profit-pricing/formatters";
import type {
  CostBreakdownGroup,
  CostBreakdownItem,
  ProfitPricingResult,
} from "@/lib/profit-pricing/types";
import { channelLabel } from "@/lib/profit-pricing/utils";

type WaterfallPoint = {
  key: string;
  label: string;
  kind: "revenue" | "cost" | "profit" | "loss";
  group?: CostBreakdownGroup;
  baseline: number;
  span: number;
  amount: number;
  remaining: number;
  percentageOfSalePrice: number | null;
  description: string;
};

type WaterfallTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: WaterfallPoint }>;
};

const GROUP_COLORS: Record<CostBreakdownGroup, string> = {
  product: "var(--primary)",
  channel: "var(--warning)",
  operation: "var(--info)",
  growth: "#ff6e9c",
  tax: "var(--accent)",
  fixed: "#62d7c3",
};

const KIND_COLORS: Record<WaterfallPoint["kind"], string> = {
  revenue: "var(--success)",
  cost: "var(--primary)",
  profit: "var(--success)",
  loss: "var(--danger)",
};

const GROUP_LABELS: Record<CostBreakdownGroup, string> = {
  product: "Ürün",
  channel: "Kanal",
  operation: "Operasyon",
  growth: "Büyüme",
  tax: "Vergi",
  fixed: "Sabit",
};

function buildWaterfallPoints(
  salePrice: number,
  netProfit: number,
  items: CostBreakdownItem[]
): WaterfallPoint[] {
  const points: WaterfallPoint[] = [
    {
      key: "sale_price",
      label: "Satış fiyatı",
      kind: "revenue",
      baseline: 0,
      span: salePrice,
      amount: salePrice,
      remaining: salePrice,
      percentageOfSalePrice: 1,
      description: "Seçili kanal için güncel satış fiyatı.",
    },
  ];

  let remaining = salePrice;

  for (const item of items.filter((entry) => entry.amount > 0)) {
    const nextRemaining = remaining - item.amount;
    points.push({
      key: item.key,
      label: item.label,
      kind: "cost",
      group: item.group,
      baseline: Math.min(remaining, nextRemaining),
      span: Math.abs(item.amount),
      amount: item.amount,
      remaining: nextRemaining,
      percentageOfSalePrice: item.percentageOfSalePrice,
      description: item.description,
    });
    remaining = nextRemaining;
  }

  points.push({
    key: "net_profit",
    label: netProfit >= 0 ? "Net kâr" : "Net zarar",
    kind: netProfit >= 0 ? "profit" : "loss",
    baseline: Math.min(0, netProfit),
    span: Math.abs(netProfit),
    amount: Math.abs(netProfit),
    remaining: netProfit,
    percentageOfSalePrice: salePrice > 0 ? netProfit / salePrice : null,
    description:
      netProfit >= 0
        ? "Tüm maliyetler düştükten sonra kalan kâr."
        : "Tüm maliyetler sonrası oluşan zarar.",
  });

  return points;
}

function getItemSourceLabel(item: CostBreakdownItem) {
  if (item.key === "ad_cost") {
    return "Reklam modülü";
  }

  if (item.key === "return_impact") {
    return "ML / risk motoru";
  }

  return null;
}

function resolveAutomaticReturnRate(result: ProfitPricingResult) {
  const stats = result.input.returnRiskContext?.stats;
  const productRate = stats?.product;
  if (productRate && productRate.orderCount > 0) {
    return productRate.returnRate;
  }

  const categoryRate = stats?.category;
  if (categoryRate && categoryRate.orderCount > 0) {
    return categoryRate.returnRate;
  }

  const channelRate = stats?.channel;
  if (channelRate && channelRate.orderCount > 0) {
    return channelRate.returnRate;
  }

  return stats?.global?.returnRate;
}

function getItemSupportText(item: CostBreakdownItem) {
  if (item.key === "ad_cost") {
    return "Bu veri reklam modülünden otomatik çekilir. Maksimum kârlı CPA hesabı bu kalemden etkilenir.";
  }

  if (item.key === "return_impact") {
    return "İade / fire etkisi ürün, kategori ve kanal geçmişine göre tahmini hesaplanır.";
  }

  return item.description;
}

function WaterfallTooltip({ active, payload }: WaterfallTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="w-[250px] rounded-2xl border border-border bg-[var(--panel-bg)] p-3 text-sm text-foreground shadow-[var(--shadow-card)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
        {point.kind === "cost" ? "Maliyet kalemi" : "Özet"}
      </p>
      <h4 className="mt-2 text-base font-semibold text-foreground">{point.label}</h4>
      <p className="mt-3 text-lg font-semibold text-foreground">
        {point.kind === "cost" ? "-" : ""}
        {formatProfitPricingCurrency(point.amount)}
      </p>
      <div className="mt-3 space-y-2 text-[12px] text-soft">
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Kalan değer</p>
          <p className="mt-1 font-medium text-foreground">
            {formatProfitPricingCurrency(point.remaining)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Satışa oran</p>
          <p className="mt-1 font-medium text-foreground">
            {formatProfitPricingPercent(point.percentageOfSalePrice)}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-5 text-soft">{point.description}</p>
    </div>
  );
}

export default function ChannelCostWaterfall(props: { result: ProfitPricingResult }) {
  const [isMounted, setIsMounted] = useState(false);
  const { result } = props;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const automaticReturnRate = resolveAutomaticReturnRate(result);
  const visibleItems = result.costBreakdown.filter((item) => item.amount > 0);
  const points = buildWaterfallPoints(result.input.salePrice, result.netProfit, visibleItems);
  const domainMin = Math.min(0, ...points.map((point) => point.baseline));
  const domainMax = Math.max(
    result.input.salePrice,
    ...points.map((point) => point.baseline + point.span)
  );

  return (
    <GlassCard className="overflow-hidden border-border/80">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/8 via-transparent to-transparent px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/600">
              Waterfall maliyet grafiği
            </p>
            <h3 className="mt-2 text-lg font-semibold text-foreground">
              {channelLabel(result.input.channel)} için net maliyet akışı
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-soft">
              `0` olan kalemler gizlenir. Böylece satış fiyatından net kâra inen gerçek maliyet
              akışı temiz ve okunabilir kalır.
            </p>
          </div>

          <div className="space-y-2 rounded-2xl border border-border bg-surface-container p-3 text-sm text-soft">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Satış fiyatı</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatProfitPricingCurrency(result.input.salePrice)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Net maliyet</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatProfitPricingCurrency(result.netCost)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Net kâr</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatProfitPricingCurrency(result.netProfit)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted/600">Marj</p>
              <p className="mt-1 font-semibold text-foreground">
                {formatProfitPricingPercent(result.profitMargin)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="h-[420px] min-w-0">
          {isMounted ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={420}>
            <BarChart
              data={points}
              layout="vertical"
              margin={{ top: 8, right: 36, left: 28, bottom: 8 }}
              barCategoryGap={18}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" horizontal={false} />
              <XAxis
                type="number"
                domain={[domainMin, domainMax]}
                stroke="var(--text-muted)"
                tickFormatter={(value) => formatProfitPricingCurrency(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={130}
                stroke="var(--text-muted)"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<WaterfallTooltip />} cursor={{ fill: "var(--grid-line)" }} />
              <ReferenceLine x={0} stroke="var(--border-strong)" />
              <Bar dataKey="baseline" stackId="waterfall" fill="transparent" isAnimationActive={true} animationDuration={400} />
              <Bar dataKey="span" stackId="waterfall" radius={[10, 10, 10, 10]} isAnimationActive={true} animationDuration={400}>
                {points.map((point) => (
                  <Cell
                    key={point.key}
                    fill={
                      point.kind === "cost"
                        ? GROUP_COLORS[point.group ?? "fixed"]
                        : KIND_COLORS[point.kind]
                    }
                    fillOpacity={point.kind === "cost" ? 0.92 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {visibleItems.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-border bg-surface-container px-3 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: GROUP_COLORS[item.group] }}
                  />
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatProfitPricingCurrency(item.amount)}
                </p>
              </div>

              {getItemSourceLabel(item) ? (
                <div className="mt-3">
                  <span className="rounded-full border border-primary/15 bg-primary/8 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {getItemSourceLabel(item)}
                  </span>
                </div>
              ) : null}

              {item.key === "return_impact" ? (
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/605">
                  <span className="rounded-full border border-border bg-surface-container px-2 py-1">
                    {formatProfitPricingPercent(automaticReturnRate)} risk oranı
                  </span>
                  <span className="rounded-full border border-border bg-surface-container px-2 py-1">
                    {formatProfitPricingCurrency(item.amount)} sipariş başı risk
                  </span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/605">
                <span className="rounded-full border border-border bg-surface-container px-2 py-1">
                  {GROUP_LABELS[item.group]}
                </span>
                <span className="rounded-full border border-border bg-surface-container px-2 py-1">
                  {formatProfitPricingPercent(item.percentageOfSalePrice)} satışa oran
                </span>
                <span className="rounded-full border border-border bg-surface-container px-2 py-1">
                  {item.isVariableWithPrice ? "Fiyata bağlı" : "Sabit etki"}
                </span>
              </div>

              <p className="mt-3 text-[11px] leading-5 text-soft">{getItemSupportText(item)}</p>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
