"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Eye, EyeOff, Loader2, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/layout/AuthContext";
import { EyebrowBadge } from "@/components/ui-custom/GlassComponents";
import { loadPublicAuthConfig } from "@/lib/supabase/auth-config-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

async function getCurrentAuthenticatedUser() {
  const res = await fetch("/api/auth/me", {
    cache: "no-store",
  });
  const data = await res.json();

  if (!res.ok || !data?.success || !data.user) {
    throw new Error(data?.error || "Oturum okunamadı.");
  }

  return data.user;
}

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!name || !email || !password) {
      setError("Tüm alanlar zorunludur.");
      return;
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    let authMode: "supabase" | "misconfigured" = "misconfigured";
    try {
      const authConfig = await loadPublicAuthConfig();
      authMode = authConfig.authMode;

      if (authMode === "misconfigured") {
        setError(authConfig.error || "Supabase auth yapılandırması eksik.");
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const signUpResult = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/auth/callback?next=/dashboard` : undefined,
        },
      });

      if (signUpResult.error) {
        throw signUpResult.error;
      }

      if (!signUpResult.data.session) {
        setNotice("Hesap oluşturuldu. Devam etmeden önce e-posta doğrulamasını tamamlayın.");
        router.push("/login?registered=1");
        router.refresh();
        return;
      }

      const sessionUser = await getCurrentAuthenticatedUser();
      if (sessionUser) {
        setUser(sessionUser);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      if (authMode === "supabase") {
        await createSupabaseBrowserClient().auth.signOut().catch(() => {});
      }
      setError(getSupabaseErrorMessage(error, "Sunucu hatası. Lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-10%] top-[-12%] h-[28rem] w-[28rem] rounded-full bg-[color-mix(in_srgb,var(--primary) 18%, transparent)] blur-[120px]" />
        <div className="absolute bottom-[-12%] right-[-8%] h-[24rem] w-[24rem] rounded-full bg-[color-mix(in_srgb,var(--accent) 12%, transparent)] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-[1040px]">
        <div className="grid overflow-hidden rounded-2xl border border-border/80 bg-panel/92 shadow-[var(--shadow-card)] backdrop-blur-2xl lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative hidden border-r border-border/80 p-10 lg:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary) 18%, transparent),transparent_38%),radial-gradient(circle_at_85%_80%,color-mix(in_srgb,var(--accent) 12%, transparent),transparent_28%)]" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                    <LineChart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold tracking-[-0.05em] text-foreground">Hesap G</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Commerce control</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Yeni çalışma alanı
                </span>

                <h1 className="mt-8 max-w-md font-heading text-[2.6rem] font-semibold tracking-[-0.08em] text-foreground">
                  Hesabınızı açın ve tüm yönetim katmanını tek panelde toplayın.
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-muted/60">
                  Kayıt sonrası ürün merkezi, tahmin, reklam analizi ve net maliyet ekranları aynı görsel sistem içinde hazır gelir.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  ["Ürün ve veri merkezi", "Operasyonel kayıtlar, maliyet parametreleri ve ayarlar tek yerde"],
                  ["Tahmin ve optimizasyon", "Talep, fiyat ve kanal kârlılığı ekranları aynı hiyerarşiyle çalışır"],
                  ["Düşük gürültülü arayüz", "Yoğun veri katmanlarında daha kontrollü kontrast ve spacing"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-xl border border-border/70 bg-surface-container/55 px-4 py-3.5">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-xs leading-6 text-muted/60">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
                <LineChart className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-[-0.05em] text-foreground">Hesap G</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted/60">Commerce control</p>
              </div>
            </div>

            <div className="mb-8">
              <EyebrowBadge>
                Hesap kurulumu
              </EyebrowBadge>
              <h2 className="mt-5 font-heading text-[2rem] font-semibold tracking-[-0.06em] text-foreground">
                Hesap oluştur
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                E-ticaret finansal kontrol merkezine erişmek için ücretsiz kayıt olun.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {notice && (
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  {notice}
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="name" className="form-label">Ad Soyad</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Eren Demir"
                  className="form-input"
                  autoComplete="name"
                  autoFocus
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="email" className="form-label">E-posta</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="eren@hesapg.com"
                  className="form-input"
                  autoComplete="email"
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="En az 6 karakter"
                    className="form-input pr-12"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">Şifre Tekrar</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Şifreyi tekrar girin"
                  className="form-input"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn("w-full btn-primary py-3.5 text-sm", loading && "cursor-wait opacity-60")}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Hesap oluşturuluyor...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Hesap oluştur
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
                Giriş yapın
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
