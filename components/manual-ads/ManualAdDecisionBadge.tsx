import { cn } from "@/lib/utils";

import { MANUAL_AD_DECISION_LABELS, type ManualAdDecision } from "@/lib/manual-ads/types";

type ManualAdDecisionBadgeProps = {
  decision: ManualAdDecision | null | undefined;
  score?: number | null;
  className?: string;
};

const DECISION_STYLES: Record<ManualAdDecision, string> = {
  scale: "border-success/25 bg-success/10 text-success",
  keep_testing: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  reduce_budget: "border-warning/25 bg-warning/10 text-warning",
  pause: "border-danger/25 bg-danger/10 text-danger",
  insufficient_data: "border-zinc-400/25 bg-zinc-400/10 text-soft",
};

export function ManualAdDecisionBadge({ decision, score, className }: ManualAdDecisionBadgeProps) {
  if (!decision) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-zinc-400/20 bg-zinc-400/10 px-3 py-1.5 text-xs font-semibold text-soft",
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300/80" />
        Analiz bekliyor
      </div>
    );
  }

  const scoreLabel = typeof score === "number" && Number.isFinite(score) ? `${Math.round(score)}/100` : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
        DECISION_STYLES[decision],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{MANUAL_AD_DECISION_LABELS[decision]}</span>
      {scoreLabel ? <span className="rounded-full border border-current/20 bg-surface-container px-2 py-0.5 text-[10px] font-bold">{scoreLabel}</span> : null}
    </div>
  );
}
