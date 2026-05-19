import "server-only";

import { evaluateLatestReturnRiskModel } from "./model-registry";

export function getReturnRiskEvaluationSummary() {
  return evaluateLatestReturnRiskModel();
}
