"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error:", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] h-[40rem] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--danger) 5%, transparent),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative text-center max-w-md">
        <div className="mb-8 inline-flex h-28 w-28 items-center justify-center rounded-3xl border border-danger/20 bg-danger/5">
          <AlertTriangle className="w-14 h-14 text-danger/40" />
        </div>

        <h1 className="mb-3 text-2xl font-bold font-heading text-foreground">Beklenmeyen bir sorun oluştu</h1>
        <p className="text-muted mb-4 leading-relaxed">
          Sayfa yüklenirken bir sorun oluştu. Tekrar deneyebilir veya ana panele dönebilirsiniz.
        </p>

        {error.digest && (
          <p className="mb-8 font-mono text-[10px] text-muted/60">
            Hata kodu: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="btn-primary py-3 px-8 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Tekrar Dene
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary py-3 px-8 text-sm"
          >
            <Home className="w-4 h-4" />
            Ana Panele Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
