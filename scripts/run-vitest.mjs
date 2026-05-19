import { cpSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = process.cwd();
const tempRoot = resolve(sourceRoot, "..", ".vitest-workspace");
const vitestBin = resolve(sourceRoot, "node_modules", "vitest", "vitest.mjs");
const vitestConfig = resolve(tempRoot, "vitest.config.mjs");
const excludeDirs = new Set(["node_modules", ".next", "coverage", ".git"]);

if (!existsSync(vitestBin)) {
  console.error("Vitest not found. Run `npm install` first.");
  process.exit(1);
}

rmSync(tempRoot, { recursive: true, force: true });
mkdirSync(tempRoot, { recursive: true });

cpSync(sourceRoot, tempRoot, {
  recursive: true,
  filter: (src) => {
    const rel = relative(sourceRoot, src);
    if (!rel || rel === ".") {
      return true;
    }

    const firstSegment = rel.split(sep)[0];
    return !excludeDirs.has(firstSegment);
  },
});

const result = spawnSync(process.execPath, [vitestBin, "--config", vitestConfig, ...process.argv.slice(2)], {
  cwd: tempRoot,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
