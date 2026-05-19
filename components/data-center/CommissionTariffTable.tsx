"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { HelpCircle } from "lucide-react";

interface TariffItem {
  id: number;
  category_id?: number | null;
  category_name: string;
  category_path: string;
  commission_rate_percent: number;
  confidence_level: string;
}

interface CommissionTariffTableProps {
  tariffs: TariffItem[];
  selectedCategoryId?: number;
}

export default function CommissionTariffTable({ tariffs, selectedCategoryId }: CommissionTariffTableProps) {
  if (!tariffs || tariffs.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center gap-3 border border-dashed border-border rounded-2xl">
        <HelpCircle className="w-8 h-8 text-muted" />
        <p className="text-sm text-muted font-medium">Bu pazar yeri için henüz kural tanımlanmamış.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/80 bg-surface-container">
              <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Kategori Path</th>
              <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Komisyon Oranı</th>
              <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center">Güven</th>
              <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {tariffs.map((item) => {
              const isSelected = item.category_id === selectedCategoryId;
              
              return (
                <tr 
                  key={item.id} 
                  className={cn(
                    "transition-colors duration-200 group hover:bg-surface-container",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <p className={cn("text-sm font-medium transition-colors duration-200", isSelected ? "text-primary" : "text-soft group-hover:text-foreground")}>
                        {item.category_name}
                      </p>
                      <p className="text-[10px] text-muted truncate max-w-md" title={item.category_path}>
                        {item.category_path}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="font-mono text-sm text-foreground font-bold">%{item.commission_rate_percent}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border",
                        item.confidence_level === 'high' 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-warning/10 text-warning border-warning/20"
                      )}>
                        {item.confidence_level === 'high' ? 'Yüksek' : 'Orta'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                       <span className="text-[10px] text-muted font-medium">Aktif</span>
                       <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[var(--shadow-card)]" />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
