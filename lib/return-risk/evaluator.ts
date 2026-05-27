import "server-only";

import { evaluateLatestReturnRiskModel } from "./model-registry";
import { requireCurrentAuthUserId } from "@/lib/tenant";

export function getReturnRiskEvaluationSummary(scopeKey = requireCurrentAuthUserId()) {
  return evaluateLatestReturnRiskModel(scopeKey);
}
