"use client";

import { usePathname } from "next/navigation";

import { AuthProvider } from "./AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { DashboardStatsProvider } from "./DashboardStatsProvider";
import ProtectedShell from "./ProtectedShell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <AuthProvider>
        {isAuthRoute ? (
          <main className="min-h-screen animate-[fadeInUp_0.4s_ease-out]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        ) : (
          <DashboardStatsProvider>
            <ProtectedShell>{children}</ProtectedShell>
          </DashboardStatsProvider>
        )}
      </AuthProvider>
    </div>
  );
}
