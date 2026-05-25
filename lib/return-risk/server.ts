import "server-only";

import { predictReturnRisk } from "./predictor";
import { buildReturnRiskContextForProduct } from "./repository";
import { loadLatestReturnRiskModelArtifact } from "./model-registry";
import { trainReturnRiskModelFromDataCenter } from "./trainer";
import { getReturnRiskEvaluationSummary } from "./evaluator";
import type { ReturnRiskPredictionInput } from "./types";

export async function predictReturnRiskFromDataCenter(
  input: Omit<ReturnRiskPredictionInput, "context" | "modelArtifact"> & {
    context?: ReturnRiskPredictionInput["context"];
  }
) {
  const dataCenterContext = await buildReturnRiskContextForProduct({
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

export async function trainReturnRiskModel() {
  return await trainReturnRiskModelFromDataCenter();
}

export function evaluateReturnRiskModel() {
  return getReturnRiskEvaluationSummary();
}
