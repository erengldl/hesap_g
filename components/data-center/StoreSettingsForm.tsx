"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui-custom/GlassComponents";
import { Info, Building2, Landmark, Receipt, Coins } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export default function StoreSettingsForm() {
  // General Expenses State
  const [expenses, setExpenses] = useState({
    employee: 0,
    rent: 3000,
    accounting: 1000,
    packaging_op: 0,
    software: 500,
    fixed_ads: 0,
    others: 500,
    monthly_orders: 500
  });

  // Company Info State
  const [companyInfo, setCompanyInfo] = useState({
    type: "sahis",
    tax_type: "gelir",
    tax_bracket: "20",
    vat_inclusive: true,
    default_vat_rate: "20",
    stoppage: false,
    invoice_type: "e-arsiv"
  });

  // Calculations
  const totalMonthlyExpense = expenses.employee + expenses.rent + expenses.accounting + 
                              expenses.packaging_op + expenses.software + expenses.fixed_ads + expenses.others;
  
  const unitFixedCost = expenses.monthly_orders > 0 ? totalMonthlyExpense / expenses.monthly_orders : 0;

  const handleExpenseChange = (field: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setExpenses(prev => ({ ...prev, [field]: numValue }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* A. GENEL GİDERLER */}
      <GlassCard className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8">
           <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Coins className="w-6 h-6" />
           </div>
           <div>
              <h3 className="text-lg font-bold text-foreground">Genel Giderler</h3>
              <p className="text-xs text-muted">Aylık operasyonel giderlerinizi yönetin.</p>
           </div>
        </div>

        <div className="space-y-6 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ExpenseField 
              label="Çalışan Maliyeti" 
              value={expenses.employee} 
              onChange={(val) => handleExpenseChange("employee", val)} 
            />
            <ExpenseField 
              label="Depo Kirası" 
              value={expenses.rent} 
              onChange={(val) => handleExpenseChange("rent", val)} 
            />
            <ExpenseField 
              label="Muhasebe / Fatura" 
              value={expenses.accounting} 
              onChange={(val) => handleExpenseChange("accounting", val)} 
            />
            <ExpenseField 
              label="Paketleme Operasyon" 
              value={expenses.packaging_op} 
              onChange={(val) => handleExpenseChange("packaging_op", val)} 
            />
            <ExpenseField 
              label="Yazılım / Araçlar" 
              value={expenses.software} 
              onChange={(val) => handleExpenseChange("software", val)} 
            />
            <ExpenseField 
              label="Reklam Sabit Bütçe" 
              value={expenses.fixed_ads} 
              onChange={(val) => handleExpenseChange("fixed_ads", val)} 
            />
            <ExpenseField 
              label="Diğer Giderler" 
              value={expenses.others} 
              onChange={(val) => handleExpenseChange("others", val)} 
            />
            <div className="space-y-2">
               <label className="form-label">Aylık Tahmini Sipariş</label>
               <input 
                 type="number" 
                 value={expenses.monthly_orders}
                 onChange={(e) => handleExpenseChange("monthly_orders", e.target.value)}
                 className="form-input"
               />
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/20 relative overflow-hidden">
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                   <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Toplam Aylık Gider</p>
                   <p className="text-3xl font-extrabold text-foreground">{formatCurrency(totalMonthlyExpense)}</p>
                </div>
                <div className="h-10 w-px bg-primary/20 hidden md:block" />
                <div className="text-center md:text-left">
                   <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Ürün Başı Sabit Gider</p>
                   <p className="text-3xl font-extrabold text-primary">{formatCurrency(unitFixedCost)}</p>
                </div>
             </div>
             <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          </div>

          <div className="p-4 rounded-xl bg-info/5 border border-info/20 flex gap-3">
             <Info className="w-5 h-5 text-info shrink-0" />
             <p className="text-[10px] text-info/70 leading-relaxed">
                Ürün başı sabit gider, <strong>Net Maliyet</strong>’nda ürün maliyetine eklenerek gerçek kârlılığı hesaplamak için kullanılır.
             </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/80">
           <button className="w-full py-3 border border-border rounded-xl text-foreground font-bold hover:bg-surface-container transition-colors duration-200 text-sm">
              Ayarları Önizle
           </button>
        </div>
      </GlassCard>

      {/* B. ŞİRKET BİLGİLERİ */}
      <GlassCard className="flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8">
           <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="w-6 h-6" />
           </div>
           <div>
              <h3 className="text-lg font-bold text-foreground">Şirket Bilgileri</h3>
              <p className="text-xs text-muted">Vergi ve maliyet hesaplama parametrelerini belirleyin.</p>
           </div>
        </div>

        <div className="space-y-6 flex-1">
          <div className="space-y-4">
              <label className="form-label">Şirket Türü</label>
             <div className="flex flex-wrap gap-2">
                {[
                  { id: "sahis", label: "Şahıs Şirketi" },
                  { id: "limited", label: "Limited Şirket" },
                  { id: "anonim", label: "Anonim Şirket" }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setCompanyInfo({ ...companyInfo, type: item.id })}
                    className={cn(
                       "flex-1 py-2 px-3 rounded-xl border text-xs transition-colors duration-200",
                      companyInfo.type === item.id 
                        ? "bg-surface-container border-border-strong text-foreground font-bold" 
                        : "bg-transparent border-border/80 text-muted hover:text-muted"
                    )}
                  >
                    {item.label}
                  </button>
                ))}
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-3">
                <label className="form-label">Vergi Mükellefiyeti</label>
                <select 
                  value={companyInfo.tax_type}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, tax_type: e.target.value })}
                  className="form-select appearance-none [&>option]:bg-panel [&>option]:text-foreground"
                >
                  <option value="gelir">Gelir Vergisi</option>
                  <option value="kurumlar">Kurumlar Vergisi</option>
                </select>
             </div>
             
             <div className="space-y-3">
                <label className="form-label">Vergi Dilimi</label>
                <select 
                  value={companyInfo.tax_bracket}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, tax_bracket: e.target.value })}
                  className="form-select appearance-none font-mono [&>option]:bg-panel [&>option]:text-foreground"
                >
                  {["15", "20", "25", "27", "35", "40"].map(v => (
                    <option key={v} value={v}>%{v}</option>
                  ))}
                </select>
             </div>

             <div className="space-y-3">
                <label className="form-label">KDV Durumu</label>
                <div className="flex flex-col gap-2">
                   {[
                     { id: true, label: "KDV dahil fiyatlandırma" },
                     { id: false, label: "KDV hariç fiyatlandırma" }
                   ].map(item => (
                     <button
                        key={String(item.id)}
                        onClick={() => setCompanyInfo({ ...companyInfo, vat_inclusive: item.id })}
                        className={cn(
                           "flex items-center gap-3 p-3 rounded-xl border text-xs text-left transition-colors duration-200",
                          companyInfo.vat_inclusive === item.id 
                            ? "bg-surface-container border-border-strong text-foreground font-bold" 
                            : "bg-transparent border-border/80 text-muted hover:text-muted"
                        )}
                     >
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center", companyInfo.vat_inclusive === item.id ? "border-primary" : "border-zinc-700")}>
                           {companyInfo.vat_inclusive === item.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        {item.label}
                     </button>
                   ))}
                </div>
             </div>

             <div className="space-y-3">
                <label className="form-label">Varsayılan KDV Oranı</label>
                <select 
                  value={companyInfo.default_vat_rate}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, default_vat_rate: e.target.value })}
                  className="form-select appearance-none font-mono [&>option]:bg-panel [&>option]:text-foreground"
                >
                  {["1", "10", "20"].map(v => (
                    <option key={v} value={v}>%{v}</option>
                  ))}
                </select>
             </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-surface-container border border-border/80">
             <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-muted" />
                <div>
                   <p className="text-sm text-foreground font-medium">Stopaj uygulanıyor mu?</p>
                   <p className="text-[10px] text-muted">Örn: Kira stopajı veya serbest meslek.</p>
                </div>
             </div>
             <button 
                onClick={() => setCompanyInfo({ ...companyInfo, stoppage: !companyInfo.stoppage })}
                className={cn(
                   "w-12 h-6 rounded-full transition-colors duration-200 relative",
                   companyInfo.stoppage ? "bg-primary" : "bg-border"
                )}
             >
                <div className={cn(
                   "absolute top-1 w-4 h-4 rounded-full bg-background transition-[left,right] duration-200",
                  companyInfo.stoppage ? "right-1" : "left-1"
                )} />
             </button>
          </div>

          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3">
             <Landmark className="w-5 h-5 text-primary shrink-0" />
             <p className="text-[10px] text-primary/70 leading-relaxed">
                Şirket bilgileri vergi, KDV ve net kâr hesaplamalarında varsayılan parametre olarak kullanılabilir.
             </p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/80">
           <button className="w-full py-3 bg-surface-container border border-border rounded-xl text-foreground font-bold hover:bg-surface-container transition-colors duration-200 text-sm">
              Şirket Bilgilerini Önizle
           </button>
        </div>
      </GlassCard>
    </div>
  );
}

function ExpenseField({ label, value, onChange }: { label: string, value: number, onChange: (val: string) => void }) {
   return (
      <div className="space-y-2">
          <label className="form-label">{label}</label>
          <div className="relative">
             <input 
                type="number" 
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                placeholder="0"
                className="form-input pr-10"
             />
             <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted font-bold">TL</span>
          </div>
       </div>
   );
}
