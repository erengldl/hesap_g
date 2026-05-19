import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
    },
  },
});
