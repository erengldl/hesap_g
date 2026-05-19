"use client";

import React from "react";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ChannelCostResult } from "@/lib/types";

interface NetCostBreakdownTableProps {
  results: ChannelCostResult[];
  bestChannelName: string;
}

type BreakdownRow = {
  key: keyof ChannelCostResult;
  label: string;
  isTraffic?: boolean;
  isFooter?: boolean;
  isFinal?: boolean;
  isPercent?: boolean;
  isTax?: boolean;
};

type BreakdownSection = {
  label: string;
  description: string;
  rows: BreakdownRow[];
};

export default function NetCostBreakdownTable({ results, bestChannelName }: NetCostBreakdownTableProps) {
  const sections: BreakdownSection[] = [
    {
      label: "Temel maliyetler",
      description: "Satış, ürün, paketleme ve taşıma",
      rows: [
        { key: "sale_price", label: "Satış fiyatı" },
        { key: "product_cost", label: "Ürün maliyeti" },
        { key: "packaging_cost", label: "Paketleme" },
        { key: "shipping_cost", label: "Kargo" },
      ],
    },
    {
      label: "Kanal giderleri",
      description: "Komisyon, altyapı ve trafik",
      rows: [
        { key: "commission_cost", label: "Komisyon" },
        { key: "platform_fee_cost", label: "Platform hizmet bedeli" },
        { key: "payment_gateway_cost", label: "Ödeme altyapısı" },
        { key: "traffic_ad_cost", label: "Trafik / reklam maliyeti", isTraffic: true },
        { key: "unit_ad_cost", label: "Ek reklam maliyeti" },
        { key: "unit_fixed_cost", label: "Sabit gider payı" },
        { key: "expected_return_cost", label: "Beklenen iade maliyeti" },
      ],
    },
    {
      label: "Sonuç ve vergiler",
      description: "Toplam, kâr ve yasal etkiler",
      rows: [
        { key: "total_unit_cost", label: "Toplam maliyet", isFooter: true },
        { key: "net_profit", label: "Net kâr", isFinal: true },
        { key: "profit_margin_percent", label: "Kâr marjı", isPercent: true },
        { key: "estimated_vat_payable", label: "KDV", isTax: true },
        { key: "income_tax", label: "Gelir vergisi", isTax: true },
        { key: "shipping_vat", label: "Kargo KDV", isTax: true },
        { key: "withholding_tax", label: "Stopaj", isTax: true },
      ],
    },
  ];

  const formatRowValue = (row: BreakdownRow, value: number) => {
    if (row.isPercent) return formatPercent(value);
    return value === 0 ? "—" : formatCurrency(value);
  };

  const getRowValue = (result: ChannelCostResult, key: keyof ChannelCostResult) =>
    Number((result as unknown as Record<string, number>)[key] ?? 0);

  const totalColumns = results.length + 1;

  return (
    <div className="rounded-2xl border border-border/80 bg-surface-container p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
            Kanal karşılaştırması
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Maliyet kırılımı
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-muted/60">
            Her kanalın maliyet bileşenlerini ve net kârını aynı tabloda, daha sakin bir görünümle inceleyin.
          </p>
        </div>
        <div className="rounded-md border border-border/80 bg-surface-container px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted/60">
          Lider kanal: {bestChannelName}
        </div>
      </div>

      <div className="space-y-3 sm:hidden">
        {results.map((result) => {
          const isBest = result.channel_name === bestChannelName;
          const summaryValue = result.net_profit === 0 ? "—" : formatCurrency(result.net_profit);

          return (
            <details
              key={result.channel_name}
              className={cn(
                "overflow-hidden rounded-2xl border",
                isBest ? "border-primary/20 bg-primary/[0.05]" : "border-border/80 bg-surface-container"
              )}
            >
              <summary className="list-none cursor-pointer p-4 outline-none">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="truncate text-sm font-medium tracking-tight text-foreground">
                        {result.channel_name}
                      </p>
                      {isBest && (
                        <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-primary">
                          Lider
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted/60">
                      Satış {formatCurrency(result.sale_price)} · Toplam {formatCurrency(result.total_unit_cost)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted/60">Net kâr</p>
                    <p className={cn("mb-1 text-lg font-semibold leading-none tracking-tight", isBest ? "text-primary" : "text-foreground")}>
                      {summaryValue}
                    </p>
                    <span
                      className={cn(
                        "inline-block rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]",
                        isBest ? "border-primary/20 bg-primary/10 text-primary" : "border-border/80 bg-surface-container text-muted/60"
                      )}
                    >
                      {formatPercent(result.profit_margin_percent)} marj
                    </span>
                  </div>
                </div>
              </summary>

              <div className="border-t border-border/80 px-4 pb-4 pt-4">
                <div className="space-y-4">
                  {sections.map((section) => (
                    <div key={section.label} className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-muted/60">{section.label}</p>
                          <p className="text-[11px] text-muted/60">{section.description}</p>
                        </div>
                        <span className="rounded-md border border-border/80 bg-surface-container px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted/60">
                          {section.rows.length} kalem
                        </span>
                      </div>

                      <div className="space-y-2">
                        {section.rows.map((row) => {
                          const value = getRowValue(result, row.key);
                          const rowTone = row.isFinal
                            ? "border-primary/15 bg-primary/[0.05]"
                            : row.isFooter
                              ? "border-border bg-surface-container"
                              : row.isTax
                                ? "border-primary/10 bg-primary/[0.03]"
                                : row.isTraffic
                                  ? "border-warning/15 bg-warning/[0.03]"
                                  : "border-border/80 bg-surface-container";

                          const labelTone = row.isFinal
                            ? "text-primary"
                            : row.isTax
                              ? "text-primary/70"
                              : row.isTraffic
                                ? "text-warning/70"
                                : "text-muted/60";

                          const valueTone = row.isFinal ? "text-foreground" : value === 0 ? "text-muted/60" : "text-foreground/80";

                          return (
                            <div
                              key={row.key}
                              className={cn("flex items-center justify-between gap-4 rounded-2xl border px-4 py-3", rowTone)}
                            >
                              <span className={cn("text-[10px] uppercase tracking-[0.16em]", labelTone)}>
                                {row.label}
                              </span>
                              <span className={cn("text-sm font-medium tracking-tight tabular-nums", valueTone)}>
                                {formatRowValue(row, value)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <div className="overflow-x-auto custom-scrollbar relative z-10 hidden sm:block">
        <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-y-2 text-left">
          <colgroup>
            <col className="w-[240px]" />
            {results.map((r) => (
              <col key={r.channel_name} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-muted/60">
              <th className="px-4 py-3">Maliyet parametresi</th>
              {results.map((r) => (
                <th
                  key={r.channel_name}
                  className={cn(
                    "px-4 py-3 text-center transition-colors duration-200",
                    r.channel_name === bestChannelName ? "text-primary" : "text-muted/60"
                  )}
                >
                  <span className="inline-flex min-w-[120px] items-center justify-center rounded-md border border-border/80 bg-surface-container px-3 py-1.5">
                    {r.channel_name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <React.Fragment key={section.label}>
                <tr>
                  <td colSpan={totalColumns} className="px-2 pb-1 pt-4">
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="rounded-md border border-border/80 bg-surface-container px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-muted/60">
                        {section.label} · {section.rows.length} kalem
                      </span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                  </td>
                </tr>

                {section.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={cn(
                      "group/row transition-colors duration-200",
                      row.isFooter ? "bg-surface-container" : "bg-surface-container hover:bg-surface-container",
                      row.isFinal ? "bg-primary/[0.05]" : "",
                      row.isTraffic ? "bg-warning/[0.03]" : ""
                    )}
                  >
                    <td
                      className={cn(
                        "rounded-l-2xl border-l px-4 py-4 align-middle transition-colors duration-200",
                        row.isFinal
                          ? "border-primary text-primary"
                          : row.isTraffic
                            ? "border-warning/40 text-warning"
                            : "border-transparent text-muted/60 group-hover/row:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-current/80" />
                        <span className="text-[10px] uppercase tracking-[0.16em]">{row.label}</span>
                      </div>
                    </td>

                    {results.map((r) => {
                      const val = getRowValue(r, row.key);
                      const isOwnWebsite = r.channel_name === "Kendi Websitem";
                      const isTrafficRow = row.isTraffic;
                      const isBest = r.channel_name === bestChannelName;

                      return (
                        <td
                          key={`${r.channel_name}-${row.key}`}
                          className={cn(
                            "rounded-r-2xl px-4 py-4 align-middle text-center transition-colors duration-200",
                            isBest ? "bg-primary/[0.04]" : "",
                            isBest && (row.isFinal || row.isFooter) ? "text-primary" : "",
                            isTrafficRow && isOwnWebsite && val > 0 ? "font-medium text-warning" : "",
                            val === 0 ? "text-muted/60" : "text-foreground/80"
                          )}
                        >
                          <span
                            className={cn(
                              row.isPercent
                                ? "inline-flex items-center justify-center text-[11px] uppercase tracking-[0.16em] text-primary"
                                : "inline-flex items-center justify-center text-sm font-medium tabular-nums"
                            )}
                          >
                            {row.isPercent ? formatPercent(val) : formatRowValue(row, val)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
