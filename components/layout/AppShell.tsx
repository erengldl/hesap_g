"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { DashboardStatsProvider } from "./DashboardStatsProvider";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "@/lib/toast";
import { ErrorBoundary } from "./ErrorBoundary";

const CommandPalette = dynamic(() => import("./CommandPalette"), {
  loading: () => null,
  ssr: false,
});

const MobileNavigation = dynamic(() => import("./MobileNavigation"), {
  loading: () => null,
  ssr: false,
});

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarHydratedRef = useRef(false);
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const sidebarStyle = {
    "--sidebar-width": sidebarCollapsed ? "96px" : "304px",
  } as React.CSSProperties & { "--sidebar-width": string };

  useEffect(() => {
    if (!sidebarHydratedRef.current) {
      sidebarHydratedRef.current = true;
      return;
    }

    window.localStorage.setItem("hg_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const stored = window.localStorage.getItem("hg_sidebar_collapsed");
    if (stored !== null) {
      setSidebarCollapsed(stored === "true");
    }
  }, []);

  const openMobileNavigation = useCallback(() => {
    setCommandPaletteOpen(false);
    setMobileNavigationOpen(true);
  }, []);
  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => !current);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground" style={sidebarStyle}>
      <ToastProvider>
        <AuthProvider>
          {isAuthRoute ? (
            <main className="min-h-screen animate-[fadeInUp_0.4s_ease-out]">
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </main>
          ) : (
            <DashboardStatsProvider>
              <>
                <Sidebar
                  collapsed={sidebarCollapsed}
                  onToggleCollapse={toggleSidebar}
                />
                <div className="relative pl-0 md:pl-[var(--sidebar-width)]">
                  <Topbar
                    onOpenMobileNavigation={openMobileNavigation}
                  />
                  <main className="min-h-screen pt-[76px] animate-[fadeInUp_0.4s_ease-out]">
                    <ErrorBoundary>
                      {children}
                    </ErrorBoundary>
                  </main>
                </div>
                <MobileNavigation
                  open={mobileNavigationOpen}
                  onOpenChange={setMobileNavigationOpen}
                />
                <CommandPalette
                  open={commandPaletteOpen}
                  onOpenChange={setCommandPaletteOpen}
                />
              </>
            </DashboardStatsProvider>
          )}
        </AuthProvider>
      </ToastProvider>
    </div>
  );
}
