import "server-only";

import { predictReturnRisk } from "./predictor";
import { buildReturnRiskContextForProduct } from "./repository";
import { loadLatestReturnRiskModelArtifact } from "./model-registry";
import { trainReturnRiskModelFromDataCenter } from "./trainer";
import { getReturnRiskEvaluationSummary } from "./evaluator";
import type { ReturnRiskPredictionInput } from "./types";

export function predictReturnRiskFromDataCenter(
  input: Omit<ReturnRiskPredictionInput, "context" | "modelArtifact"> & {
    context?: ReturnRiskPredictionInput["context"];
  }
) {
  const dataCenterContext = buildReturnRiskContextForProduct({
    productId: input.productId,
    channel: input.channel,
  });
  const modelArtifact = loadLatestReturnRiskModelArtifact();

  return predictReturnRisk({
    ...input,
    context: {
      ...dataCenterContext,
      ...input.context,
      stats: input.context?.stats ?? dataCenterContext.stats,
    },
    modelArtifact,
  });
}

export function trainReturnRiskModel() {
  return trainReturnRiskModelFromDataCenter();
}

export function evaluateReturnRiskModel() {
  return getReturnRiskEvaluationSummary();
}
