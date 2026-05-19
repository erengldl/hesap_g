export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-[-10rem] h-[40rem] bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--success) 6%, transparent),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm text-center">
        <div className="mb-7 mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-[var(--shadow-primary)]">
          <span className="text-primary text-2xl font-extrabold italic tracking-tighter">G</span>
        </div>

        <div className="space-y-3">
          <div className="h-4 rounded-full bg-surface-container skeleton-shimmer" />
          <div className="h-4 rounded-full bg-surface-container skeleton-shimmer w-5/6 mx-auto" />
          <div className="h-4 rounded-full bg-surface-container skeleton-shimmer w-2/3 mx-auto" />
        </div>

        <p className="mt-7 text-sm font-medium text-muted">
          Veriler hazırlanıyor...
        </p>
        <p className="mt-2 text-xs leading-5 text-muted/60">
          Sayfa kısa süre içinde açılacak.
        </p>
      </div>
    </div>
  );
}
