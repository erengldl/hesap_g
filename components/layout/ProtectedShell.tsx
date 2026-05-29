"use client";

import { Suspense, useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { ErrorBoundary } from "./ErrorBoundary";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";
import MobileNavigation from "./MobileNavigation";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "@/lib/toast";

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    setMobileNavigationOpen(false);
    setCommandPaletteOpen(false);
  }, []);

  const shellStyle = {
    "--sidebar-width": sidebarCollapsed ? "80px" : "256px",
  } as CSSProperties;

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
      style={shellStyle}
    >
      <ToastProvider>
        <Suspense fallback={null}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
          />
          <Topbar
            onOpenMobileNavigation={() => setMobileNavigationOpen(true)}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />
          <MobileNavigation
            open={mobileNavigationOpen}
            onOpenChange={setMobileNavigationOpen}
          />
          <CommandPalette
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
          />
        </Suspense>

        <main className="min-h-screen pt-[76px] md:pl-[var(--sidebar-width)]">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </ToastProvider>
    </div>
  );
}
