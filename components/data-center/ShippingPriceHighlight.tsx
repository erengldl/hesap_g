"use client";

import React from "react";
import { Truck, Info, Zap } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface ShippingPriceHighlightProps {
  marketplace: string;
  desi: number;
  cheapestCarrier: string;
  cheapestPrice: number;
}

export default function ShippingPriceHighlight({
  marketplace,
  desi,
  cheapestCarrier,
  cheapestPrice
}: ShippingPriceHighlightProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-success/20 bg-success/5 p-6 backdrop-blur-md">
      {/* Glow Effect */}
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-success/20 blur-[40px] rounded-full" />
      
      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 rounded-2xl bg-success/20 flex items-center justify-center text-success">
              <Truck className="w-8 h-8" />
           </div>
           <div>
              <p className="text-[10px] font-bold text-success/70 uppercase tracking-widest mb-1">En Uygun Seçenek</p>
              <h4 className="text-xl font-extrabold text-foreground">
                Desi {desi} için en uygun {marketplace} anlaşmalı kargo:
              </h4>
              <p className="text-sm text-muted mt-1">
                Kargo firması: <span className="text-success font-bold">{cheapestCarrier}</span>
              </p>
           </div>
        </div>

        <div className="text-center md:text-right">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/20 border border-success/30 text-success text-[10px] font-bold uppercase tracking-widest mb-2">
              <Zap className="w-3 h-3 fill-current" />
              En Ucuz Fiyat
           </div>
           <div className="text-4xl font-extrabold text-success">
             {formatCurrency(cheapestPrice)}
           </div>
           <p className="text-[10px] text-muted mt-1 italic flex items-center justify-center md:justify-end gap-1">
              <Info className="w-3 h-3" />
              KDV bilgisi kaynak veriye göre değişebilir.
           </p>
        </div>
      </div>
    </div>
  );
}
