"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface MatrixRow {
  desi: number;
  prices: Record<string, number>;
}

interface ShippingTariffMatrixProps {
  carriers: string[];
  rows: MatrixRow[];
  selectedDesi?: number | null;
  onSelectDesi?: (desi: number) => void;
  carrierFilter: string;
}

export default function ShippingTariffMatrix({ 
  carriers, 
  rows, 
  selectedDesi, 
  onSelectDesi,
  carrierFilter
}: ShippingTariffMatrixProps) {
  
  const filteredCarriers = carrierFilter 
    ? carriers.filter(c => c.toLowerCase().includes(carrierFilter.toLowerCase()))
    : carriers;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-surface-container">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/80 bg-surface-container">
              <th className="sticky left-0 z-10 bg-panel px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest border-r border-border/80">
                Desi
              </th>
              {filteredCarriers.map((carrier) => (
                <th key={carrier} className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-center whitespace-nowrap min-w-[120px]">
                  {carrier}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const isSelected = selectedDesi === row.desi;
              
              // Find cheapest price in this row for highlights
              let minPrice = Infinity;
              let maxPrice = -Infinity;
              Object.values(row.prices).forEach(p => {
                if (p < minPrice) minPrice = p;
                if (p > maxPrice) maxPrice = p;
              });

              return (
                <tr 
                  key={row.desi}
                  onClick={() => onSelectDesi?.(row.desi)}
                  className={cn(
                    "transition-all duration-200 cursor-pointer",
                    isSelected ? "bg-success/10" : "hover:bg-surface-container"
                  )}
                >
                  <td className={cn(
                    "sticky left-0 z-10 px-6 py-3 font-mono text-sm font-bold text-center border-r border-border/80 transition-colors duration-200",
                    isSelected ? "bg-success/15 text-success" : "bg-panel text-muted"
                  )}>
                    {row.desi}
                  </td>
                  {filteredCarriers.map((carrier) => {
                    const price = row.prices[carrier];
                    const isCheapest = price === minPrice && minPrice !== Infinity;
                    const isExpensive = price === maxPrice && maxPrice !== Infinity && price !== minPrice;

                    return (
                      <td key={carrier} className="px-6 py-3 text-center">
                        {price ? (
                          <div className="flex flex-col items-center gap-1">
                             <span className={cn(
                               "text-sm font-bold transition-all duration-200",
                               isCheapest ? "text-success scale-110" : isExpensive ? "text-muted" : "text-foreground"
                             )}>
                               {formatCurrency(price)}
                             </span>
                             {isCheapest && (
                               <span className="text-[8px] font-extrabold uppercase text-success/60 tracking-tighter">En İyi</span>
                             )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-800">--</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: var(--surface-strong);
          border-radius: var(--radius-sm);
        }
      `}</style>
    </div>
  );
}
