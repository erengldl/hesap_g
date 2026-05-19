"use client";

import React, { useEffect, useState } from "react";
import { Monitor, Moon, SunMedium } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

type ThemeOption = {
  value: ThemeChoice;
  label: string;
  description: string;
  icon: React.ElementType;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: "light",
    label: "Açık",
    description: "Aynı düzenin daha yumuşak, açık yüzeyli versiyonu",
    icon: SunMedium,
  },
  {
    value: "dark",
    label: "Koyu",
    description: "Referans dashboard diliyle varsayılan görünüm",
    icon: Moon,
  },
  {
    value: "system",
    label: "Sistem",
    description: "İşletim sisteminin temasını takip eder",
    icon: Monitor,
  },
];

export function ThemeModeSelector({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = (theme ?? "system") as ThemeChoice;
  const effectiveTheme = activeTheme === "system" ? (resolvedTheme ?? "dark") : activeTheme;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-2 md:grid-cols-3">
        {THEME_OPTIONS.map((option) => {
          const isActive = mounted && activeTheme === option.value;
          const Icon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              disabled={!mounted}
              aria-pressed={isActive}
              className={cn(
                "group flex min-h-[96px] flex-col justify-between rounded-xl border px-4 py-4 text-left transition-colors duration-200",
                isActive
                  ? "border-primary/30 bg-primary/10 text-foreground shadow-[var(--shadow-primary)]"
                  : "border-border bg-card text-muted hover:border-border-strong hover:bg-surface-container hover:text-foreground",
                !mounted && "cursor-wait opacity-70"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors duration-200",
                    isActive ? "text-primary" : "text-muted/60 group-hover:text-primary"
                  )}
                />
                {isActive && (
                  <span className="rounded-md border border-primary/20 bg-primary/12 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Aktif
                  </span>
                )}
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-sm font-semibold tracking-tight text-current">{option.label}</p>
                <p className="text-[11px] leading-5 text-muted/60">{option.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-container px-4 py-3 text-xs text-muted">
        <span>Seçim cihazda theme anahtarına kaydedilir.</span>
        <span className="font-semibold text-soft">
          {mounted
            ? `Aktif görünüm: ${effectiveTheme === "dark" ? "Koyu" : "Açık"}`
            : "Görünüm seçenekleri hazırlanıyor"}
        </span>
      </div>
    </div>
  );
}
