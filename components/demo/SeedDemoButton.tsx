"use client";

import { useState } from "react";
import { CloudDownload, Loader2 } from "lucide-react";

import { type SeedDemoResponse } from "@/lib/seed-demo-contract";
import { cn } from "@/lib/utils";

type SeedDemoButtonProps = {
  className?: string;
  confirmMessage?: string;
  onError?: (message: string) => void;
  onStart?: () => void;
  onSeeded?: (result: SeedDemoResponse) => Promise<void> | void;
};

type SeedDemoActionOptions = {
  confirmMessage?: string;
  onError?: (message: string) => void;
  onStart?: () => void;
  onSeeded?: (result: SeedDemoResponse) => Promise<void> | void;
};

const DEMO_SEED_ENABLED = process.env.NODE_ENV !== "production";
const DEMO_SEED_DISABLED_MESSAGE = "Demo verileri production ortaminda kapali.";

export async function triggerSeedDemo({
  confirmMessage,
  onError,
  onStart,
  onSeeded,
}: SeedDemoActionOptions) {
  if (!DEMO_SEED_ENABLED) {
    onError?.(DEMO_SEED_DISABLED_MESSAGE);
    return;
  }

  onStart?.();

  if (confirmMessage && !window.confirm(confirmMessage)) {
    return;
  }

  try {
    const response = await fetch("/api/seed-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = (await response.json().catch(() => null)) as SeedDemoResponse | null;

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || "Demo verileri yuklenemedi.");
    }

    if (onSeeded) {
      await onSeeded(data);
      return;
    }

    window.location.reload();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Demo verileri yuklenemedi.";
    if (onError) {
      onError(message);
      return;
    }

    console.error("Seed demo error:", error);
  }
}

export function SeedDemoButton({
  className,
  confirmMessage,
  onError,
  onStart,
  onSeeded,
}: SeedDemoButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!DEMO_SEED_ENABLED) {
    return null;
  }

  const handleClick = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await triggerSeedDemo({
        confirmMessage,
        onError,
        onStart,
        onSeeded,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => {
        void handleClick();
      }}
      disabled={loading}
      aria-busy={loading}
      className={cn("btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60", className)}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudDownload className="h-4 w-4" />}
      {loading ? "Demo verileri yukleniyor..." : "Demo Verileri Yukle"}
    </button>
  );
}
