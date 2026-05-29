"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, Sparkles, UserPlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/layout/AuthContext";
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
    } catch (err) {
      if (authMode === "supabase") {
        await createSupabaseBrowserClient().auth.signOut().catch(() => {});
      }
      setError(getSupabaseErrorMessage(err, "Sunucu hatası. Lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell-backdrop app-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[1180px]">
        <div className="grid overflow-hidden rounded-[36px] border border-slate-900/8 bg-white/82 shadow-[var(--shadow-panel)] backdrop-blur-xl lg:grid-cols-[1.02fr_0.98fr]">
          <section className="relative hidden min-h-[780px] border-r border-slate-900/8 p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,139,141,0.18),transparent_38%),radial-gradient(circle_at_80%_78%,rgba(242,183,102,0.18),transparent_26%)]" />
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[var(--shadow-primary)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xl font-semibold tracking-tight text-foreground">Hesap G</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    Commerce command
                  </p>
                </div>
              </div>

              <span className="app-chip mt-8">Yeni çalışma alanı</span>
              <h1 className="mt-8 max-w-xl text-[3.2rem] font-semibold leading-[1.04] tracking-[-0.08em] text-foreground">
                Operasyon merkezini birkaç dakikada kur ve ilk kârlılık görünümünü aç.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-soft">
                Kayıt sonrası veri merkezi, net maliyet ve fiyat ekranları aynı bilgi mimarisiyle hazır gelir.
              </p>
            </div>

            <div className="relative grid gap-3">
              {[
                ["Ürün ve maliyet omurgası", "Katalog, komisyon, kargo ve mağaza ayarlarını aynı merkezde topla."],
                ["Daha okunur karar yüzeyi", "Yoğun finans verisini daha kontrollü kontrast ve spacing ile yönet."],
                ["Ölçeklenebilir modül yapısı", "Tahmin, SEO ve reklam modülleri aynı kabukta tutarlı kalır."],
              ].map(([title, text]) => (
                <div key={title} className="rounded-[24px] border border-white/60 bg-white/70 px-5 py-4 shadow-[var(--shadow-card)]">
                  <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-soft">{text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-semibold tracking-tight text-foreground">Hesap G</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Commerce command
                </p>
              </div>
            </div>

            <span className="app-chip">Kayıt</span>
            <h2 className="mt-6 text-[2.4rem] font-semibold tracking-[-0.06em] text-foreground">
              Hesap oluştur
            </h2>
            <p className="mt-3 max-w-md text-base leading-7 text-soft">
              Hesap G çalışma alanını kullanmak için temel hesap bilgilerini girin.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {notice ? <Banner tone="success">{notice}</Banner> : null}
              {error ? <Banner tone="danger">{error}</Banner> : null}

              <Field label="Ad Soyad" id="name">
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
              </Field>

              <Field label="E-posta" id="email">
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
              </Field>

              <Field label="Şifre" id="password">
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
              </Field>

              <Field label="Şifre tekrar" id="confirmPassword">
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
              </Field>

              <button
                type="submit"
                disabled={loading}
                className={cn("btn-primary w-full py-3.5 text-sm", loading && "cursor-wait opacity-60")}
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

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Zaten hesabınız var mı?{" "}
              <Link href="/login" className="font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
                Giriş yapın
              </Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      {children}
    </div>
  );
}

function Banner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-[20px] border px-4 py-3 text-sm",
        tone === "success"
          ? "border-success/20 bg-success/10 text-success"
          : "border-danger/20 bg-danger/10 text-danger"
      )}
    >
      {children}
    </div>
  );
}
