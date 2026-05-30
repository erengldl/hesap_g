"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LineChart, Loader2, LogIn, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/layout/AuthContext";
import { StatusBadge } from "@/components/ui-custom/GlassComponents";
import { cn } from "@/lib/utils";

const VALUE_PROMISES = [
  "Ürün maliyetini hesapla",
  "Kârlı fiyatı bul",
  "Riskli stok ve reklamı yakala",
];

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";
  const { setUser } = useAuth();
  const showDemoCredentials = process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("E-posta ve şifre gerekli.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || "Giriş başarısız.");
        return;
      }

      if (data.user) {
        setUser(data.user);
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[30rem] w-[30rem] rounded-full bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] blur-[140px]" />
        <div className="absolute bottom-[-16%] right-[-8%] h-[26rem] w-[26rem] rounded-full bg-[color-mix(in_srgb,var(--profit)_14%,transparent)] blur-[140px]" />
      </div>

      <div className="relative w-full max-w-[1100px]">
        <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-panel/92 shadow-[var(--shadow-card)] backdrop-blur-2xl lg:grid-cols-[1.04fr_0.96fr]">
          <section className="relative hidden border-r border-border/80 p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_34%),radial-gradient(circle_at_80%_75%,color-mix(in_srgb,var(--info)_10%,transparent),transparent_26%)]" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                    <LineChart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.03em] text-foreground">Hesap G</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Financial control center</p>
                  </div>
                </div>

                <StatusBadge tone="neutral" className="mt-8">
                  Güvenli giriş ve karar odaklı iş akışları
                </StatusBadge>

                <h1 className="mt-8 max-w-xl font-heading text-[2.8rem] font-semibold leading-[1.02] tracking-[-0.08em] text-foreground">
                  E-ticaret kârını, fiyatını ve reklam performansını tek panelde kontrol et.
                </h1>
                <p className="mt-5 max-w-lg text-sm leading-7 text-muted">
                  İlk girişten itibaren hedef aynı: önce verini hazırla, sonra marjı gör, fiyat ve reklam kararlarını aynı sistemde ilerlet.
                </p>
              </div>

              <div className="grid gap-3">
                {VALUE_PROMISES.map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface-container/55 px-4 py-3.5">
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold tabular-nums",
                      index === 0 ? "border-primary/25 bg-primary/12 text-primary" : index === 1 ? "border-profit/20 bg-profit/10 text-profit" : "border-warning/20 bg-warning/10 text-warning"
                    )}>
                      0{index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item}</p>
                      <p className="mt-1 text-xs leading-6 text-muted">
                        {index === 0
                          ? "Ürün, kanal ve sipariş verisiyle net maliyeti tek yerde gör."
                          : index === 1
                            ? "Marjı düşük kalan ürünleri hızla bul ve fiyat akışını optimize et."
                            : "Stok ve reklam kayıplarını ekran kalabalığı olmadan yakala."}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                <LineChart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[-0.03em] text-foreground">Hesap G</p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Financial control center</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-surface-container/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Güvenli erişim
              </div>
              <h2 className="mt-5 font-heading text-[2rem] font-semibold tracking-[-0.06em] text-foreground">
                Hesabınıza girin
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted">
                Kontrol paneline erişmek için e-posta ve şifrenizi girin. Giriş sonrası yönlendirme aynı şekilde korunur.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              ) : null}

              <div>
                <label htmlFor="email" className="form-label">E-posta</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="magaza@ornek.com"
                  className="form-input"
                  autoComplete="email"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="form-label">Şifre</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="form-input pr-12"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    aria-pressed={showPassword}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn("w-full btn-primary py-3 text-sm", loading && "cursor-wait opacity-60")}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Giriş Yap
                  </>
                )}
              </button>
            </form>

            {showDemoCredentials ? (
              <div className="mt-6 rounded-xl border border-border/80 bg-surface-container/55 px-4 py-3 text-xs text-muted">
                Demo erişim: <span className="font-semibold text-foreground">admin@hesapg.com / admin123</span>
              </div>
            ) : null}

            <p className="mt-6 text-center text-xs text-muted">
              Hesabınız yok mu?{" "}
              <Link href="/register" className="font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
                Kayıt olun
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
