import type { ProfitDecision } from "./types";
import { PROFIT_THRESHOLDS } from "./types";

export function decideProfitability(params: {
  netProfit: number;
  profitMargin: number | null;
  hasBlockingMissingData: boolean;
  hasErrors: boolean;
}): ProfitDecision {
  if (params.hasBlockingMissingData || params.hasErrors) {
    return "missing_data";
  }

  if (params.netProfit < 0) {
    return "loss";
  }

  if (params.profitMargin === null) {
    return "missing_data";
  }

  if (params.profitMargin < PROFIT_THRESHOLDS.borderlineMargin) {
    return "borderline";
  }

  if (params.profitMargin < PROFIT_THRESHOLDS.healthyMargin) {
    return "profitable_but_low_margin";
  }

  return "profitable";
}

