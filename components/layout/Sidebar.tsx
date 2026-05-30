"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { useDashboardStats } from "./DashboardStatsProvider";
import { navigationSections, type NavigationItem } from "./navigation";

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
      style={{ "--stagger-delay": `${(staggerIndex ?? 0) * 50}ms` } as React.CSSProperties}
      className={cn(
        "group relative flex items-center animate-stagger-item transition-all duration-200",
        collapsed
          ? "justify-center rounded-xl border px-0 py-3.5"
          : "gap-3 rounded-lg px-3 py-3",
        isActive
          ? "border-primary/30 bg-primary/12 text-primary"
          : "border-transparent text-muted hover:bg-surface-container/75 hover:text-foreground"
      )}
    >
      {collapsed ? null : (
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
            isActive ? "text-primary" : "text-muted/60 group-hover:text-foreground/60"
          )}
        />
      )}

      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-md border transition-colors duration-200",
          collapsed ? "h-11 w-11" : "h-9 w-9",
          isActive
            ? "border-primary/30 bg-background/70 text-primary"
            : "border-border/70 bg-surface-container/35 text-muted/60 group-hover:border-border-strong group-hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4" />
      </div>

      {!collapsed && <span className="min-w-0 flex-1 truncate text-[0.95rem] font-semibold">{item.name}</span>}

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
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[var(--sidebar-width)] flex-col border-r border-border/80 bg-panel/96 backdrop-blur-2xl transition-[width] duration-300 md:flex">
      <div className="border-b border-border/80 px-4 pb-5 pt-5">
        <div
          className={cn(
            "rounded-2xl border border-border/70 bg-surface-container/58",
            collapsed ? "px-2 py-3" : "px-4 py-4"
          )}
        >
          <div className={cn("flex items-center", collapsed ? "flex-col gap-3" : "gap-3")}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/30 bg-primary/12 text-primary">
              <LineChart className="h-5 w-5" />
            </div>

            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[1rem] font-semibold tracking-[-0.02em] text-foreground">
                  Hesap G
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Sidebarı genişlet" : "Sidebarı daralt"}
              className={cn(
                "flex shrink-0 items-center justify-center rounded-md border border-border/80 bg-surface-container/55 text-muted transition-colors duration-200 hover:border-border-strong hover:text-foreground",
                collapsed ? "h-10 w-10" : "h-10 w-10"
              )}
            >
              <ChevronLeft className={cn("h-4 w-4 transition-transform duration-200", collapsed && "rotate-180")} />
            </button>
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-6">
          {navigationSections.map((section, sectionIndex) => (
            <section key={section.title}>
              {!collapsed && (
                <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                  {section.title}
                </p>
              )}
              <div className={cn("space-y-1.5", collapsed && "space-y-2")}>
                {section.items.map((item, itemIndex) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    collapsed={collapsed}
                    isActive={isActivePath(pathname, item.href)}
                    badge={item.href === "/veri-merkezi" ? alertCount : undefined}
                    staggerIndex={sectionIndex * 4 + itemIndex}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </nav>
    </aside>
  );
}
