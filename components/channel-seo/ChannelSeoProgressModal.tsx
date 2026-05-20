"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ChannelSeoProgressModalProps = {
  open: boolean;
  title: string;
  current: number;
  total: number;
  success: number;
  error: number;
  skipped: number;
  onClose?: () => void;
  className?: string;
};

export function ChannelSeoProgressModal({
  open,
  title,
  current,
  total,
  success,
  error,
  skipped,
  onClose,
  className,
}: ChannelSeoProgressModalProps) {
  const progress = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
  } as const;
  const panelVariants = {
    hidden: { opacity: 0, scale: 0.97 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } },
  } as const;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn("fixed inset-0 z-[200] flex items-center justify-center bg-panel/55 px-4 py-6 backdrop-blur-sm", className)}
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl border border-border bg-panel shadow-[var(--shadow-card)]"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Toplu optimizasyon</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted">{current}/{total} ürün işlendi</p>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-container text-muted transition-colors duration-200 hover:text-foreground active:scale-[0.98]"
              aria-label="İlerleme penceresini kapat"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          ) : null}
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{progress}% tamamlandı</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-success/20 bg-success/10 p-4">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Tamamlanan</p>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-foreground">{success}</p>
            </div>
            <div className="rounded-xl border border-danger/20 bg-danger/10 p-4">
              <div className="flex items-center gap-2 text-danger">
                <XCircle className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Hatalı</p>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-foreground">{error}</p>
            </div>
            <div className="rounded-xl border border-border bg-surface-container/60 p-4">
              <div className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">Atlanan</p>
              </div>
              <p className="mt-2 text-2xl font-extrabold text-foreground">{skipped}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-container/30 p-4 text-sm text-muted">
            İşlem sürerken pencereyi açık tutabilir, ilerlemeyi anlık izleyebilirsiniz. Kaydedilmemiş içerikler taslak olarak kalır.
          </div>
        </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
