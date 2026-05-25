import "server-only";

import { listReturnRiskTrainingRows } from "./repository";
import { trainReturnRiskLogisticModel } from "./model";
import { saveReturnRiskModelArtifact } from "./model-registry";
import type { ReturnRiskTrainingResult } from "./types";

export async function trainReturnRiskModelFromDataCenter(): Promise<ReturnRiskTrainingResult> {
  const rows = await listReturnRiskTrainingRows();
  const positiveRows = rows.filter((row) => row.isReturnedOrLost).length;
  const trained = trainReturnRiskLogisticModel(rows);

  if (!trained.artifact) {
    return {
      ok: false,
      modelVersion: null,
      modelType: "typescript-logistic-regression",
      trainingRows: rows.length,
      positiveRows,
      metrics: null,
      reason: trained.reason ?? "Model egitilemedi.",
    };
  }

  saveReturnRiskModelArtifact(trained.artifact);

  return {
    ok: true,
    modelVersion: trained.artifact.modelVersion,
    modelType: trained.artifact.modelType,
    trainingRows: trained.artifact.trainingRows,
    positiveRows: trained.artifact.positiveRows,
    metrics: trained.artifact.metrics,
  };
}
