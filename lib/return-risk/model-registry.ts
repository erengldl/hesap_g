import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { ReturnRiskModelArtifact } from "./types";

const MODEL_DIR = path.join(process.cwd(), "Veri Merkezi", "return-risk-models");
const GLOBAL_SCOPE_KEY = "global";

function sanitizeScopeKey(scopeKey?: string | null) {
  const trimmed = scopeKey?.trim() || GLOBAL_SCOPE_KEY;
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getScopeDirectory(scopeKey?: string | null) {
  const normalized = sanitizeScopeKey(scopeKey);
  return normalized === GLOBAL_SCOPE_KEY ? MODEL_DIR : path.join(MODEL_DIR, normalized);
}

function getVersionFilePath(modelVersion: string, scopeKey?: string | null) {
  const normalized = sanitizeScopeKey(scopeKey);
  return normalized === GLOBAL_SCOPE_KEY
    ? path.join(MODEL_DIR, `${modelVersion}.json`)
    : path.join(getScopeDirectory(normalized), `${modelVersion}.json`);
}

function getLatestModelFilePath(scopeKey?: string | null) {
  const normalized = sanitizeScopeKey(scopeKey);
  return normalized === GLOBAL_SCOPE_KEY
    ? path.join(MODEL_DIR, "latest.json")
    : path.join(getScopeDirectory(normalized), "latest.json");
}

function ensureModelDir(scopeKey?: string | null) {
  const scopeDir = getScopeDirectory(scopeKey);
  if (!fs.existsSync(scopeDir)) {
    fs.mkdirSync(scopeDir, { recursive: true });
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

export function saveReturnRiskModelArtifact(artifact: ReturnRiskModelArtifact, scopeKey: string = GLOBAL_SCOPE_KEY) {
  ensureModelDir(scopeKey);
  const versionFile = getVersionFilePath(artifact.modelVersion, scopeKey);
  const latestFile = getLatestModelFilePath(scopeKey);
  const payload = JSON.stringify(artifact, null, 2);
  fs.writeFileSync(versionFile, payload, "utf8");
  fs.writeFileSync(latestFile, payload, "utf8");
}

export function loadLatestReturnRiskModelArtifact(scopeKey: string = GLOBAL_SCOPE_KEY) {
  try {
    const latestFile = getLatestModelFilePath(scopeKey);
    if (!fs.existsSync(latestFile)) {
      return null;
    }

    return parseArtifact(fs.readFileSync(latestFile, "utf8"));
  } catch {
    return null;
  }
}

export function evaluateLatestReturnRiskModel(scopeKey: string = GLOBAL_SCOPE_KEY) {
  const artifact = loadLatestReturnRiskModelArtifact(scopeKey);
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
