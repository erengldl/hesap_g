import fs from "node:fs";
import path from "node:path";

function isAppRoot(candidate: string) {
  return (
    fs.existsSync(path.join(candidate, "package.json")) &&
    fs.existsSync(path.join(candidate, "app")) &&
    fs.existsSync(path.join(candidate, "lib"))
  );
}

export function resolveAppRoot() {
  const configuredRoot = process.env.HESAP_G_APP_ROOT?.trim();
  if (configuredRoot && isAppRoot(configuredRoot)) {
    return configuredRoot;
  }

  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    if (isAppRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return process.cwd();
}

export function resolveFromAppRoot(...segments: string[]) {
  return path.join(resolveAppRoot(), ...segments);
}
