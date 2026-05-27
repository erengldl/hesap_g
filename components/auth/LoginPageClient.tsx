"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LineChart, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { cn } from "@/lib/utils";
import { useAuth } from "@/components/layout/AuthContext";
import { FormField } from "@/components/ui-custom/FormComponents";
import { EyebrowBadge } from "@/components/ui-custom/GlassComponents";
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
                    <p className="text-xs uppercase tracking-[0.18em] text-muted/60">Commerce control</p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Referans dashboard sistemi
                </span>

                <h1 className="mt-8 max-w-md font-heading text-[2.6rem] font-semibold tracking-[-0.08em] text-foreground">
                  Finans, ürün ve reklam akışını tek panelden yönetin.
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-muted/60">
                  Girişten sonra aynı oturum tüm uygulama yüzeyinde geçerli olur. Supabase oturumu tarayıcı ve server tarafında aynı akışta kullanılır.
                </p>
              </div>

              <div className="grid gap-3">
                {[
                  ["Gerçek zamanlı özet", "Ciro, sipariş, marj ve alarm akışları tek üst katmanda"],
                  ["Kanal bazlı kararlar", "Maliyet, reklam ve fiyat simülasyonları tek görsel sistemde"],
                  ["Odaklı karanlık tema", "Düşük ışıkta daha iyi okunurluk ve daha az görsel gürültü"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-xl border border-border/70 bg-surface-container/55 px-4 py-3.5">
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted/60">{text}</p>
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
                <p className="text-xs uppercase tracking-[0.18em] text-muted/60">Commerce control</p>
              </div>
            </div>

            <div className="mb-8">
              <EyebrowBadge>Güvenli erişim</EyebrowBadge>
              <h2 className="mt-5 font-heading text-[2rem] font-semibold tracking-[-0.06em] text-foreground">
                Hoş geldiniz
              </h2>
              <p className="mt-3 max-w-md text-sm leading-7 text-muted/60">
                E-ticaret finansal kontrol merkezine erişmek için giriş yapın.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {showRegistrationNotice ? (
                <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
                  Hesap oluşturuldu. E-posta doğrulaması gerekiyorsa önce kutunuzu kontrol edin, sonra giriş yapın.
                </div>
              ) : null}

              {showCallbackError ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  E-posta doğrulama oturumu tamamlanamadı. Lütfen tekrar giriş yapın.
                </div>
              ) : null}

              {serverError ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {serverError}
                </div>
              ) : null}

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
                className={cn("w-full btn-primary py-3.5 text-sm", loading && "cursor-wait opacity-60")}
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

            {process.env.NODE_ENV !== "production" ? (
              <div className="mt-8 flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface-container/55 px-4 py-3 text-sm text-muted/60">
                <span>Demo erişim</span>
                <span className="font-semibold text-foreground">admin@hesapg.com / admin123</span>
              </div>
            ) : null}

            <p className="mt-6 text-center text-sm text-muted">
              Hesabınız yok mu?{" "}
              <Link href="/register" className="font-semibold text-primary transition-colors duration-200 hover:text-primary/80">
                Kayıt olun
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
