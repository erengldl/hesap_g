"use client";

import { cn } from "@/lib/utils";

type ChannelSeoEditableTitleProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
};

export function ChannelSeoEditableTitle({
  value,
  onChange,
  placeholder = "Kanal bazlı başlık yazın",
  maxLength = 180,
  disabled = false,
  className,
  compact = false,
  ariaLabel,
}: ChannelSeoEditableTitleProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={ariaLabel ?? "Ürün başlığı"}
        className={cn(
          "form-input w-full rounded-md border border-border bg-surface-container text-foreground placeholder:text-muted/60",
          compact ? "py-2 text-sm" : "py-2.5 text-sm",
          disabled ? "opacity-60" : ""
        )}
      />
      <div className="flex items-center justify-between gap-3 text-[10px] text-muted/60">
        <span className="truncate">{value.length > 0 ? "Düzenlenebilir kanal başlığı" : "Başlık boş"}</span>
        <span className={cn("shrink-0", value.length > maxLength * 0.85 ? "text-warning" : "")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
