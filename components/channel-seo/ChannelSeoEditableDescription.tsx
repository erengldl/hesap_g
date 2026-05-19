"use client";

import { cn } from "@/lib/utils";

type ChannelSeoEditableDescriptionProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
};

export function ChannelSeoEditableDescription({
  value,
  onChange,
  placeholder = "Kanal bazlı açıklama yazın",
  maxLength = 2000,
  disabled = false,
  className,
  compact = false,
  ariaLabel,
}: ChannelSeoEditableDescriptionProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        aria-label={ariaLabel ?? "Ürün açıklaması"}
        rows={compact ? 3 : 7}
        className={cn(
          "form-textarea w-full rounded-md border border-border bg-surface-container text-foreground placeholder:text-muted/60",
          "resize-none",
          compact ? "py-2 text-sm leading-6" : "py-2.5 text-sm leading-6",
          disabled ? "opacity-60" : ""
        )}
      />
      <div className="flex items-center justify-between gap-3 text-[10px] text-muted/60">
        <span className="truncate">{value.length > 0 ? "Kanal açıklaması düzenlenebilir" : "Açıklama boş"}</span>
        <span className={cn("shrink-0", value.length > maxLength * 0.85 ? "text-warning" : "")}>
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}
