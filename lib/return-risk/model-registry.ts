import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { ReturnRiskModelArtifact } from "./types";

const MODEL_DIR = path.join(process.cwd(), "Veri Merkezi", "return-risk-models");
const LATEST_MODEL_FILE = path.join(MODEL_DIR, "latest.json");

function ensureModelDir() {
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
  }
}

function parseArtifact(value: string): ReturnRiskModelArtifact | null {
  try {
    const parsed = JSON.parse(value) as ReturnRiskModelArtifact;
    if (!parsed.modelVersion || !Array.isArray(parsed.weights)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveReturnRiskModelArtifact(artifact: ReturnRiskModelArtifact) {
  ensureModelDir();
  const versionFile = path.join(MODEL_DIR, `${artifact.modelVersion}.json`);
  const payload = JSON.stringify(artifact, null, 2);
  fs.writeFileSync(versionFile, payload, "utf8");
  fs.writeFileSync(LATEST_MODEL_FILE, payload, "utf8");
}

export function loadLatestReturnRiskModelArtifact() {
  try {
    if (!fs.existsSync(LATEST_MODEL_FILE)) {
      return null;
    }

    return parseArtifact(fs.readFileSync(LATEST_MODEL_FILE, "utf8"));
  } catch {
    return null;
  }
}

export function evaluateLatestReturnRiskModel() {
  const artifact = loadLatestReturnRiskModelArtifact();
  if (!artifact) {
    return null;
  }

  return {
    modelVersion: artifact.modelVersion,
    modelType: artifact.modelType,
    metrics: artifact.metrics,
    lastTrainedAt: artifact.trainedAt,
    trainingRows: artifact.trainingRows,
    positiveRows: artifact.positiveRows,
  };
}
