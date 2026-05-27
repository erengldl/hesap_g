"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { AuthProvider } from "./AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";

const ProtectedShell = dynamic(() => import("./ProtectedShell"), {
  loading: () => null,
});

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const sidebarHydratedRef = useRef(false);
  const isAuthRoute = pathname === "/login" || pathname === "/register";

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

  const openCommandPalette = useCallback(() => {
    setMobileNavigationOpen(false);
    setCommandPaletteOpen(true);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => !current);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AuthProvider>
        {isAuthRoute ? (
          <main className="min-h-screen animate-[fadeInUp_0.4s_ease-out]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        ) : (
          <ProtectedShell
            sidebarCollapsed={sidebarCollapsed}
            commandPaletteOpen={commandPaletteOpen}
            mobileNavigationOpen={mobileNavigationOpen}
            onToggleSidebar={toggleSidebar}
            onOpenMobileNavigation={openMobileNavigation}
            onOpenCommandPalette={openCommandPalette}
            onMobileNavigationOpenChange={setMobileNavigationOpen}
            onCommandPaletteOpenChange={setCommandPaletteOpen}
          >
            {children}
          </ProtectedShell>
        )}
      </AuthProvider>
    </div>
  );
}
