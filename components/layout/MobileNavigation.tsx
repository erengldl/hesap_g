"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";

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

type MobileNavigationProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function MobileLeafLink({
  item,
  pathname,
  searchQuery,
  onSelect,
}: {
  item: NavigationLink;
  pathname: string;
  searchQuery: string;
  onSelect: () => void;
}) {
  const active = matchesNavigationHref(pathname, searchQuery, item.href);

  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-colors duration-150",
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/70 hover:text-foreground"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150",
          active ? "bg-primary" : "bg-border"
        )}
      />
      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
    </Link>
  );
}

function MobileSection({
  section,
  expanded,
  onToggle,
  pathname,
  searchQuery,
  onSelect,
  badgeCount,
}: {
  section: NavigationSection;
  expanded: boolean;
  onToggle: () => void;
  pathname: string;
  searchQuery: string;
  onSelect: () => void;
  badgeCount?: number;
}) {
  const sectionActive = isSectionActive(section, pathname, searchQuery);
  const hasChildren = Boolean(section.links?.length);

  if (!hasChildren && section.href) {
    return (
      <Link
        href={section.href}
        onClick={onSelect}
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors duration-150",
          sectionActive
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/70 hover:text-foreground"
        )}
      >
        <section.icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{section.name}</span>
      </Link>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left transition-colors duration-150",
          sectionActive
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-surface-container/70 hover:text-foreground"
        )}
      >
        <span className="flex items-center gap-3 min-w-0">
          <section.icon className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">{section.name}</span>
        </span>

        <span className="flex items-center gap-2">
          {badgeCount && badgeCount > 0 ? <NotificationBadge count={badgeCount} /> : null}
          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-150", expanded && "rotate-180")} />
        </span>
      </button>

      {expanded && section.links ? (
        <div className="space-y-1 pl-4">
          {section.links.map((item) => (
            <MobileLeafLink
              key={item.href}
              item={item}
              pathname={pathname}
              searchQuery={searchQuery}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function MobileNavigation({ open, onOpenChange }: MobileNavigationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.toString();
  const { stats } = useDashboardStats();
  const alertCount = stats?.stockAlerts ?? 0;
  const [expandedSections, setExpandedSections] = useState<string[]>([]);

  const activeSectionNames = useMemo(() => {
    return sidebarNavigationSections
      .filter((section) => section.links?.some((link) => matchesNavigationHref(pathname, searchQuery, link.href)))
      .map((section) => section.name);
  }, [pathname, searchQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    setExpandedSections(activeSectionNames);
  }, [activeSectionNames]);

  if (!open) return null;

  const toggleSection = (sectionName: string) => {
    setExpandedSections((current) =>
      current.includes(sectionName)
        ? current.filter((value) => value !== sectionName)
        : [...current, sectionName]
    );
  };

  return (
    <div className="fixed inset-0 z-[180] md:hidden">
      <button
        type="button"
        aria-label="Mobil menüyü kapat"
        className="absolute inset-0 bg-panel/60 backdrop-blur-[4px]"
        onClick={() => onOpenChange(false)}
      />

      <aside className="absolute left-0 top-0 flex h-full w-[84vw] max-w-sm animate-slide-in-left flex-col border-r border-border/80 bg-panel/98 shadow-[var(--shadow-card)] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">Hesap G</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted/60">
              Minimal panel
            </p>
          </div>

          <button
            type="button"
            aria-label="Menüyü kapat"
            onClick={() => onOpenChange(false)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-container text-muted transition-colors duration-150 hover:bg-card hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="custom-scrollbar flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-1.5">
            {sidebarNavigationSections.map((section) => {
              const expanded = expandedSections.includes(section.name);
              const badgeCount = section.name === "Veri Merkezi" ? alertCount : undefined;

              return (
                <MobileSection
                  key={section.name}
                  section={section}
                  expanded={expanded}
                  onToggle={() => toggleSection(section.name)}
                  pathname={pathname}
                  searchQuery={searchQuery}
                  onSelect={() => onOpenChange(false)}
                  badgeCount={badgeCount}
                />
              );
            })}
          </div>
        </nav>
      </aside>
    </div>
  );
}
