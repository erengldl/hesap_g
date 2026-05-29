"use client";

import { usePathname } from "next/navigation";

import { AuthProvider } from "./AuthContext";
import { ErrorBoundary } from "./ErrorBoundary";
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
          <ProtectedShell>{children}</ProtectedShell>
        )}
      </AuthProvider>
    </div>
  );
}
