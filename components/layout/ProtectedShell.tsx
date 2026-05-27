"use client";

import dynamic from "next/dynamic";
import React from "react";

import { ToastProvider } from "@/lib/toast";

import { DashboardStatsProvider } from "./DashboardStatsProvider";
import { ErrorBoundary } from "./ErrorBoundary";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const CommandPalette = dynamic(() => import("./CommandPalette"), {
  loading: () => null,
  ssr: false,
});

const MobileNavigation = dynamic(() => import("./MobileNavigation"), {
  loading: () => null,
  ssr: false,
});

const OnboardingWizard = dynamic(
  () => import("../onboarding/OnboardingWizard").then((module) => module.OnboardingWizard),
  {
    loading: () => null,
    ssr: false,
  }
);

type ProtectedShellProps = {
  children: React.ReactNode;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  mobileNavigationOpen: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNavigation: () => void;
  onOpenCommandPalette: () => void;
  onMobileNavigationOpenChange: (open: boolean) => void;
  onCommandPaletteOpenChange: (open: boolean) => void;
};

export default function ProtectedShell({
  children,
  sidebarCollapsed,
  commandPaletteOpen,
  mobileNavigationOpen,
  onToggleSidebar,
  onOpenMobileNavigation,
  onOpenCommandPalette,
  onMobileNavigationOpenChange,
  onCommandPaletteOpenChange,
}: ProtectedShellProps) {
  const sidebarStyle = {
    "--sidebar-width": sidebarCollapsed ? "96px" : "304px",
  } as React.CSSProperties & { "--sidebar-width": string };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
      style={sidebarStyle}
    >
      <ToastProvider>
        <DashboardStatsProvider>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={onToggleSidebar}
          />
          <Topbar
            onOpenMobileNavigation={onOpenMobileNavigation}
            onOpenCommandPalette={onOpenCommandPalette}
          />
          <MobileNavigation
            open={mobileNavigationOpen}
            onOpenChange={onMobileNavigationOpenChange}
          />
        </DashboardStatsProvider>

        <div className="relative pl-0 md:pl-[var(--sidebar-width)]">
          <main className="min-h-screen pt-[76px] animate-[fadeInUp_0.4s_ease-out]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>

        <OnboardingWizard />
        <CommandPalette
          open={commandPaletteOpen}
          onOpenChange={onCommandPaletteOpenChange}
        />
      </ToastProvider>
    </div>
  );
}
