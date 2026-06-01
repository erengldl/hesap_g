import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const nextDir = path.join(repoRoot, ".next");
const standaloneDir = path.join(nextDir, "standalone");
const standaloneNextDir = path.join(standaloneDir, ".next");

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function syncStaticAssets() {
  const staticSource = path.join(nextDir, "static");
  const staticTarget = path.join(standaloneNextDir, "static");

  if (await pathExists(staticSource)) {
    await mkdir(path.dirname(staticTarget), { recursive: true });
    await cp(staticSource, staticTarget, { recursive: true, force: true });
  }

  const publicSource = path.join(repoRoot, "public");
  const publicTarget = path.join(standaloneDir, "public");

  if (await pathExists(publicSource)) {
    await mkdir(path.dirname(publicTarget), { recursive: true });
    await cp(publicSource, publicTarget, { recursive: true, force: true });
  }
}

async function main() {
  if (!(await pathExists(path.join(standaloneDir, "server.js")))) {
    console.error("Standalone build bulunamadi. Once `npm run build` calistirin.");
    process.exit(1);
  }

  await syncStaticAssets();

  if (!process.env.JWT_SECRET?.trim()) {
    console.warn("JWT_SECRET ayarli degil. Production login akisi calismayacak.");
  }

  const child = spawn(process.execPath, ["server.js"], {
    cwd: standaloneDir,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Standalone server baslatilamadi:", error);
  process.exit(1);
});
