import Link from "next/link";
import { Database, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] h-[40rem] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--success) 6%, transparent),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative text-center max-w-md">
        <div className="mb-8 inline-flex h-28 w-28 items-center justify-center rounded-3xl bg-surface-container border border-border/40">
          <span className="text-7xl font-extrabold text-primary/20 tracking-tighter">404</span>
        </div>
        <h1 className="mb-3 text-2xl font-bold font-heading text-foreground">Sayfa bulunamadı</h1>
        <p className="text-muted mb-10 leading-relaxed">
          Aradığınız sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir. URL&apos;yi kontrol edin veya ana panele dönün.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/dashboard"
            className="btn-primary py-3 px-8 text-sm"
          >
            <Home className="w-4 h-4" />
            Ana Panele Dön
          </Link>
          <Link
            href="/veri-merkezi"
            className="btn-secondary py-3 px-8 text-sm"
          >
            <Database className="w-4 h-4" />
            Veri Merkezini Aç
          </Link>
        </div>
      </div>
    </div>
  );
}
