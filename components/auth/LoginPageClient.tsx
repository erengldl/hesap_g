"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, LogIn, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/layout/AuthContext";
import { FormField } from "@/components/ui-custom/FormComponents";
import { loadPublicAuthConfig } from "@/lib/supabase/auth-config-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";
import { loginSchema, type LoginSchemaInput } from "@/lib/validation-schemas";

type LoginPageClientProps = {
  redirectPath: string;
  showRegistrationNotice: boolean;
  showCallbackError: boolean;
};

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

export default function LoginPageClient({
  redirectPath,
  showRegistrationNotice,
  showCallbackError,
}: LoginPageClientProps) {
  const router = useRouter();
  const { setUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginSchemaInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginSchemaInput) => {
    setServerError("");
    setLoading(true);

    let authMode: "supabase" | "misconfigured" = "misconfigured";
    try {
      const authConfig = await loadPublicAuthConfig();
      authMode = authConfig.authMode;

      if (authMode === "misconfigured") {
        setServerError(authConfig.error || "Supabase auth yapılandırması eksik.");
        return;
      }

      const email = values.email.trim();
      const supabase = createSupabaseBrowserClient();
      const signInResult = await supabase.auth.signInWithPassword({
        email,
        password: values.password,
      });

      if (signInResult.error) {
        throw signInResult.error;
      }

      const sessionUser = await getCurrentAuthenticatedUser();
      if (sessionUser) {
        setUser(sessionUser);
      }

      router.push(redirectPath);
      router.refresh();
    } catch (error) {
      if (authMode === "supabase") {
        await createSupabaseBrowserClient().auth.signOut().catch(() => {});
      }
      setServerError(getSupabaseErrorMessage(error, "Sunucu hatası. Lütfen tekrar deneyin."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell-backdrop app-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[1180px]">
        <div className="grid overflow-hidden rounded-[36px] border border-slate-900/8 bg-white/82 shadow-[var(--shadow-panel)] backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden min-h-[780px] border-r border-slate-900/8 p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,139,141,0.18),transparent_38%),radial-gradient(circle_at_80%_78%,rgba(79,124,255,0.14),transparent_26%)]" />
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

              <span className="app-chip mt-8">Güvenli erişim</span>
              <h1 className="mt-8 max-w-xl text-[3.35rem] font-semibold leading-[1.02] tracking-[-0.08em] text-foreground">
                Finans, ürün ve büyüme kararlarını tek operasyon omurgasında birleştir.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-soft">
                Giriş yaptıktan sonra aynı oturum tüm uygulama yüzeyinde çalışır. Veri merkezi, net maliyet ve fiyat kararları tek ritimde akar.
              </p>
            </div>

            <div className="relative grid gap-3">
              {[
                ["Canlı durum görünümü", "Ciro, sipariş, marj ve stok sinyallerini aynı kontrol merkezinde izle."],
                ["Karar odaklı ekranlar", "Her modül daha kısa, daha okunur ve daha az gürültülü bilgi katmanıyla çalışır."],
                ["Hazır demo erişim", "Geliştirme ortamında demo hesapla tüm akışı saniyeler içinde test et."],
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

            <span className="app-chip">Giriş</span>
            <h2 className="mt-6 text-[2.5rem] font-semibold tracking-[-0.06em] text-foreground">
              Hoş geldiniz
            </h2>
            <p className="mt-3 max-w-md text-base leading-7 text-soft">
              Hesap G çalışma alanına devam etmek için oturum açın.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5" noValidate>
              {showRegistrationNotice ? (
                <Banner tone="success">
                  Hesap oluşturuldu. E-posta doğrulaması gerekiyorsa önce kutunuzu kontrol edin, sonra giriş yapın.
                </Banner>
              ) : null}

              {showCallbackError ? (
                <Banner tone="danger">
                  E-posta doğrulama oturumu tamamlanamadı. Lütfen tekrar giriş yapın.
                </Banner>
              ) : null}

              {serverError ? <Banner tone="danger">{serverError}</Banner> : null}

              <FormField
                id="email"
                type="email"
                label="E-posta"
                placeholder="admin@hesapg.com"
                autoComplete="email"
                autoFocus
                disabled={loading}
                error={errors.email?.message}
                {...register("email")}
              />

              <div className="space-y-2">
                <label htmlFor="password" className="form-label">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className={cn("form-input pr-12", errors.password && "border-danger/50")}
                    autoComplete="current-password"
                    disabled={loading}
                    aria-invalid={Boolean(errors.password)}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted transition-colors duration-200 hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password?.message ? (
                  <p className="mt-1.5 text-xs text-danger">{errors.password.message}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn("btn-primary w-full py-3.5 text-sm", loading && "cursor-wait opacity-60")}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Giriş yap
                  </>
                )}
              </button>
            </form>

            {process.env.NODE_ENV !== "production" ? (
              <div className="mt-8 rounded-[24px] border border-slate-900/8 bg-surface-soft px-5 py-4">
                <p className="app-section-title">Demo erişim</p>
                <p className="mt-2 text-sm font-semibold text-foreground">admin@hesapg.com / admin123</p>
              </div>
            ) : null}

            <p className="mt-8 text-center text-sm text-muted-foreground">
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
