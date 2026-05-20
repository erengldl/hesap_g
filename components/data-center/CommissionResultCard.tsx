"use client";

import React from "react";
import { AlertCircle, ShieldCheck, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommissionResultCardProps {
  marketplace: string;
  selectedCategory: string;
  matchedCategory: string;
  commissionRate: number;
  matchType: "direct" | "parent_fallback" | "global_fallback";
  warning?: string | null;
}

export default function CommissionResultCard({
  marketplace,
  selectedCategory,
  matchedCategory,
  commissionRate,
  matchType,
  warning
}: CommissionResultCardProps) {
  const getBadgeConfig = () => {
    switch (matchType) {
      case "direct":
        return { label: "Birebir Kategori", className: "bg-success/10 text-success border-success/20" };
      case "parent_fallback":
        return { label: "Üst Kategori Fallback", className: "bg-warning/10 text-warning border-warning/20" };
      case "global_fallback":
        return { label: "Genel Fallback", className: "bg-info/10 text-info border-info/20" };
      default:
        return { label: "Bilinmeyen", className: "bg-zinc-500/10 text-muted border-zinc-500/20" };
    }
  };

  const badge = getBadgeConfig();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-container p-6 backdrop-blur-md">
      {/* Decorative background element */}
      <div className={cn(
        "absolute -right-8 -top-8 w-32 h-32 blur-[60px] opacity-20 rounded-full",
        matchType === "direct" ? "bg-success" : matchType === "parent_fallback" ? "bg-warning" : "bg-info"
      )} />

      <div className="relative space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted flex items-center gap-2">
              <Tag className="w-3 h-3" />
              Hesaplanan Komisyon
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-foreground">%{commissionRate}</span>
              <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-semibold border uppercase tracking-[0.14em]", badge.className)}>
                {badge.label}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-right">
             <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Pazaryeri</p>
                <p className="text-sm font-bold text-foreground">{marketplace}</p>
             </div>
             <div className="w-px h-8 bg-border/80" />
             <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Güven Durumu</p>
                <p className="text-sm font-bold text-success flex items-center gap-1.5">
                   <ShieldCheck className="w-4 h-4" />
                   Yüksek
                </p>
             </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl bg-surface-container border border-border/80 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Seçili Kategori</p>
              <p className="text-xs text-soft truncate" title={selectedCategory}>{selectedCategory}</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-container border border-border/80 space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Kullanılan Kural Kapsamı</p>
              <p className="text-xs text-soft truncate" title={matchedCategory}>{matchedCategory}</p>
            </div>
          </div>

          {warning && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning/90 leading-relaxed font-medium">
                {warning}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
