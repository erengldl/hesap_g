"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";

import { NotificationBadge } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "./DashboardStatsProvider";
import {
  isSectionActive,
  matchesNavigationHref,
  sidebarNavigationSections,
  type NavigationLink,
  type NavigationSection,
} from "./navigation";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarLeafLink({
  item,
  pathname,
  searchQuery,
}: {
  item: NavigationLink;
  pathname: string;
  searchQuery: string;
}) {
  const active = matchesNavigationHref(pathname, searchQuery, item.href);

  return (
    <Link
      href={item.href}
      title={item.name}
      aria-label={item.name}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors duration-150",
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/60 hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150",
          active ? "bg-primary" : "bg-border group-hover:bg-foreground/60"
        )}
      />
      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
    </Link>
  );
}

function SidebarSection({
  section,
  collapsed,
  expanded,
  onToggle,
  pathname,
  searchQuery,
  badgeCount,
}: {
  section: NavigationSection;
  collapsed: boolean;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  searchQuery: string;
  badgeCount?: number;
}) {
  const sectionActive = isSectionActive(section, pathname, searchQuery);
  const hasChildren = Boolean(section.links?.length);

  if (!hasChildren && section.href) {
    return (
      <Link
        href={section.href}
        title={section.name}
        aria-label={section.name}
        className={cn(
          "group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150",
          collapsed ? "justify-center" : "justify-start",
          sectionActive
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/60 hover:text-foreground"
        )}
      >
        <section.icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {section.name}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={section.name}
        title={section.name}
        className={cn(
          "group relative flex w-full items-center rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
          collapsed ? "justify-center" : "justify-between",
          sectionActive
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/60 hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-3 min-w-0">
          <section.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate text-sm font-medium">{section.name}</span>}
        </span>

        {!collapsed && (
          <span className="flex items-center gap-2">
            {badgeCount && badgeCount > 0 ? (
              <NotificationBadge count={badgeCount} />
            ) : null}
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                expanded && "rotate-180"
              )}
            />
          </span>
        )}

        {collapsed && badgeCount && badgeCount > 0 ? (
          <span className="absolute right-1 top-1">
            <NotificationBadge count={badgeCount} />
          </span>
        ) : null}
      </button>

      {!collapsed && expanded && section.links ? (
        <div className="space-y-1 pl-4">
          {section.links.map((item) => (
            <SidebarLeafLink
              key={item.href}
              item={item}
              pathname={pathname}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const { stats } = useDashboardStats();
  const alertCount = stats?.stockAlerts ?? 0;
  const [expandedSections, setExpandedSections] = useState<string[]>(() => []);

  const activeSectionNames = useMemo(() => {
    return sidebarNavigationSections
      .filter((section) => section.links?.some((link) => matchesNavigationHref(pathname, searchQuery, link.href)))
      .map((section) => section.name);
  }, [pathname, searchQuery]);

  useEffect(() => {
    setExpandedSections(activeSectionNames);
  }, [activeSectionNames]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((current) =>
      current.includes(sectionName)
        ? current.filter((value) => value !== sectionName)
        : [...current, sectionName]
    );
  };

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-full w-[var(--sidebar-width)] flex-col border-r border-white/10 bg-surface/85 backdrop-blur-xl md:flex">
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-5">
        {!collapsed ? (
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-primary">
              Hesap G
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
              Panel
            </p>
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-primary">
            <span className="text-sm font-bold">G</span>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Sidebarı genişlet" : "Sidebarı daralt"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground transition-colors duration-150 hover:border-white/20 hover:text-foreground"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-150", collapsed && "rotate-180")} />
        </button>
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-1.5">
          {sidebarNavigationSections.map((section) => {
            const expanded = expandedSections.includes(section.name);
            const badgeCount = section.name === "Veri Merkezi" ? alertCount : undefined;

            return (
              <SidebarSection
                key={section.name}
                section={section}
                collapsed={collapsed}
                expanded={expanded}
                onToggle={() => toggleSection(section.name)}
                pathname={pathname}
                searchQuery={searchQuery}
                badgeCount={badgeCount}
              />
            );
          })}
        </div>
      </nav>
    </aside>
  );
}
