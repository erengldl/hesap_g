import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCLI, startVitest } from "vitest/node";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliArgs = ["vitest", ...process.argv.slice(2)];
const parsed = parseCLI(cliArgs);

const cliOptions = {
  ...parsed.options,
  root: repoRoot,
  config: false,
  run: parsed.options.run ?? false,
  watch: parsed.options.run ? false : parsed.options.watch ?? true,
  environment: "jsdom",
  globals: true,
  fileParallelism: false,
  testTimeout: 10000,
};

const viteOverrides = {
  resolve: {
    alias: {
      "@": repoRoot,
    },
  },
};

const ctx = await startVitest("test", parsed.filter, cliOptions, viteOverrides);

if (ctx && typeof ctx.getUnhandledErrors === "function") {
  const unhandledErrors = ctx.getUnhandledErrors();
  if (Array.isArray(unhandledErrors) && unhandledErrors.length > 0) {
    process.exitCode = 1;
  }
}
