"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "./AuthContext";
import { ToastProvider } from "@/lib/toast";

export default function ProtectedShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <ToastProvider>
        <header className="sticky top-0 z-40 border-b border-white/10 bg-surface/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/net-maliyet-motoru" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                <span className="material-symbols-outlined text-[18px]">calculate</span>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight text-foreground">Hesap G</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
                  Net maliyet modu
                </p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              {user?.email ? (
                <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-muted-foreground md:inline-flex">
                  {user.email}
                </span>
              ) : null}
              <Link
                href="/net-maliyet-motoru"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/25 hover:bg-surface-container"
              >
                Net Maliyet
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-danger/25 hover:bg-danger/10 hover:text-danger"
              >
                Çıkış
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto min-h-[calc(100vh-4rem)] w-full max-w-6xl animate-[fadeInUp_0.35s_ease-out] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </ToastProvider>
    </div>
  );
}
