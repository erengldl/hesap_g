import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveFromAppRoot } from "./runtime-paths";

export const BUNDLED_DATABASE_PATH = resolveFromAppRoot("Veri Merkezi", "kategoriagaci.db");
export const TEMP_DATABASE_PATH = path.join(os.tmpdir(), "hesap-g-kategoriagaci.db");

function pathExists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function copyBundledDatabaseToTemp() {
  if (!pathExists(BUNDLED_DATABASE_PATH)) {
    return null;
  }

  const bundledStats = fs.statSync(BUNDLED_DATABASE_PATH);
  const tempStats = pathExists(TEMP_DATABASE_PATH) ? fs.statSync(TEMP_DATABASE_PATH) : null;
  const shouldRefresh =
    !tempStats ||
    bundledStats.mtimeMs > tempStats.mtimeMs ||
    bundledStats.size !== tempStats.size;

  if (shouldRefresh) {
    fs.mkdirSync(path.dirname(TEMP_DATABASE_PATH), { recursive: true });
    fs.copyFileSync(BUNDLED_DATABASE_PATH, TEMP_DATABASE_PATH);
  }

  return TEMP_DATABASE_PATH;
}

export function resolveLocalDatabasePath(options: { preferWritableCopy?: boolean } = {}) {
  const preferWritableCopy = Boolean(options.preferWritableCopy);

  if (preferWritableCopy) {
    return copyBundledDatabaseToTemp() ?? (pathExists(TEMP_DATABASE_PATH) ? TEMP_DATABASE_PATH : null);
  }

  if (pathExists(BUNDLED_DATABASE_PATH)) {
    return BUNDLED_DATABASE_PATH;
  }

  return pathExists(TEMP_DATABASE_PATH) ? TEMP_DATABASE_PATH : null;
}

export function isBundledDatabaseAvailable() {
  return pathExists(BUNDLED_DATABASE_PATH) || pathExists(TEMP_DATABASE_PATH);
}
