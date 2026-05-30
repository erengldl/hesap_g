import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: configDir,
  },
  serverExternalPackages: ["better-sqlite3", "bcryptjs", "postgres"],
  outputFileTracingIncludes: {
    "/*": ["Veri Merkezi/kategoriagaci.db"],
  },
};

export default nextConfig;
