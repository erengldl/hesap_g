"use client";

import { useState } from "react";
import { CloudDownload } from "lucide-react";

import { type SeedDemoResponse } from "@/lib/seed-demo-contract";
import { cn } from "@/lib/utils";

type SeedDemoButtonProps = {
  className?: string;
  confirmMessage?: string;
  onError?: (message: string) => void;
  onSeeded?: (result: SeedDemoResponse) => Promise<void> | void;
};

export function SeedDemoButton({
  className,
  confirmMessage,
  onError,
  onSeeded,
}: SeedDemoButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;

    setLoading(true);
    try {
      const response = await fetch("/api/seed-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await response.json().catch(() => null)) as SeedDemoResponse | null;
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Demo verileri yüklenemedi.");
      }

      if (onSeeded) {
        await onSeeded(data);
      } else {
        window.location.reload();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Demo verileri yüklenemedi.";
      if (onError) {
        onError(message);
      } else {
        window.alert(message);
      }
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
      <CloudDownload className={cn("h-4 w-4", loading && "animate-bounce")} />
      {loading ? "Demo verileri yükleniyor..." : "Demo Verileri Yükle"}
    </button>
  );
}
