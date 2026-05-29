"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { useDashboardStats } from "./DashboardStatsProvider";
import { navigationItems, type NavigationItem } from "./navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

type SidebarLinkProps = {
  item: NavigationItem;
  collapsed: boolean;
  isActive: boolean;
  badge?: number;
  staggerIndex?: number;
};

function SidebarLink({ item, collapsed, isActive, badge, staggerIndex }: SidebarLinkProps) {
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <Link
      href={item.href}
      aria-label={item.name}
      title={item.name}
      style={{ "--stagger-delay": `${(staggerIndex ?? 0) * 40}ms` } as React.CSSProperties}
      className={cn(
        "group relative flex items-center animate-stagger-item transition-all duration-200 border-l-4",
        collapsed
          ? "justify-center rounded-lg border-transparent px-0 py-3.5 hover:bg-white/5"
          : "gap-3 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.12em]",
        isActive
          ? "bg-primary-soft/10 text-primary border-primary"
          : "border-transparent text-muted-foreground hover:bg-white/[0.03] hover:text-foreground"
      )}
    >
      <div className="flex shrink-0 items-center justify-center">
        <item.icon className="h-4.5 w-4.5" />
      </div>

      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.name}</span>}

      {!collapsed && showBadge && <NotificationBadge count={badge} />}
      {collapsed && showBadge && (
        <span className="absolute right-2 top-2">
          <NotificationBadge count={badge} />
        </span>
      )}
    </Link>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { stats } = useDashboardStats();
  const alertCount = stats?.stockAlerts ?? 0;

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[var(--sidebar-width)] flex-col border-r border-white/10 bg-surface-dim/80 backdrop-blur-xl transition-[width] duration-300 md:flex">
      {/* Branding Area */}
      <div className="px-6 pb-4 pt-7 flex items-center justify-between">
        {!collapsed ? (
          <div>
            <h1 className="font-heading text-[2rem] font-bold text-primary tracking-tighter leading-none">
              Hesap G
            </h1>
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mt-1.5">
              Premium E-Commerce
            </p>
          </div>
        ) : (
          <div className="flex w-full justify-center">
            <h1 className="font-heading text-2xl font-bold text-primary">H</h1>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Sidebarı genişlet" : "Sidebarı daralt"}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors duration-200 hover:border-white/20 hover:text-foreground",
            collapsed ? "h-8 w-8 mx-auto" : "h-8 w-8"
          )}
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation Area */}
      <nav className="custom-scrollbar flex-1 overflow-y-auto py-5">
        <div className="space-y-6">
          <section>
            {!collapsed && (
              <p className="mb-3 px-6 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground/50">
                Menü
              </p>
            )}
            <div className={cn("space-y-1", collapsed && "px-2 space-y-2")}>
              {navigationItems.map((item, index) => (
                <SidebarLink
                  key={item.href}
                  item={item}
                  collapsed={collapsed}
                  isActive={isActivePath(pathname, item.href)}
                  badge={item.href === "/veri-merkezi" ? alertCount : undefined}
                  staggerIndex={index}
                />
              ))}
            </div>
          </section>
        </div>
      </nav>

      {/* Call To Action Box (hidden when collapsed) */}
      {!collapsed && (
        <div className="px-6 py-6 border-t border-white/10">
          <div className="glass-panel p-4 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              Başlangıç akışı
            </p>
            <p className="mt-2 text-xs font-semibold tracking-tight text-foreground">
              1. Ürünü seç 2. Kârı gör 3. En uygun kanalı uygula
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Karar almak için önce Veri Merkezi'nden başlaman en hızlı yol.
            </p>
            <Link
              href="/veri-merkezi"
              className="btn-primary mt-3 w-full justify-center text-[11px] font-bold uppercase tracking-wider py-2"
            >
              Veri Merkezi
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}
