import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
});
