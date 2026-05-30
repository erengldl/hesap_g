"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LineChart, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { useDashboardStats } from "./DashboardStatsProvider";
import { navigationSections, type NavigationItem } from "./navigation";

type MobileNavigationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

type MobileLinkProps = {
  item: NavigationItem;
  isActive: boolean;
  onSelect: () => void;
  badge?: number;
};

function MobileSidebarLink({ item, isActive, onSelect, badge }: MobileLinkProps) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
        isActive ? "bg-primary/12 text-primary" : "text-muted hover:bg-surface-container/75 hover:text-foreground"
      )}
    >
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
          isActive ? "text-primary" : "text-muted/60 group-hover:text-foreground/60"
        )}
      />
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
          isActive
            ? "border-primary/30 bg-background/70 text-primary"
            : "border-border/70 bg-surface-container/35 text-muted/60 group-hover:border-border-strong group-hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
      </div>
      <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">{item.name}</span>
      {typeof badge === "number" && badge > 0 && <NotificationBadge count={badge} />}
    </Link>
  );
}

export default function MobileNavigation({ open, onOpenChange }: MobileNavigationProps) {
  const pathname = usePathname();
  const { stats } = useDashboardStats();
  const alertCount = stats?.stockAlerts ?? 0;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[180] md:hidden">
      <button
        type="button"
        aria-label="Mobil menüyü kapat"
        className="absolute inset-0 bg-panel/60 backdrop-blur-[4px]"
        onClick={() => onOpenChange(false)}
      />

      <aside className="absolute left-0 top-0 flex h-full w-[86vw] max-w-sm animate-slide-in-left flex-col border-r border-border/80 bg-panel/98 shadow-[var(--shadow-card)] backdrop-blur-2xl">
        <div className="border-b border-border/80 px-4 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/70 bg-surface-container/58 px-3.5 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/12 text-primary">
                <LineChart className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-foreground">
                  Hesap G
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">Karar akışı</p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={() => onOpenChange(false)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-container text-muted transition-colors duration-200 hover:bg-card hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            {navigationSections.map((section) => (
              <section key={section.title}>
                <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.items.map((item) => (
                    <MobileSidebarLink
                      key={item.href}
                      item={item}
                      isActive={isActivePath(pathname, item.href)}
                      onSelect={() => onOpenChange(false)}
                      badge={item.href === "/veri-merkezi" ? alertCount : undefined}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>
      </aside>
    </div>
  );
}
