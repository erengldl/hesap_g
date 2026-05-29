import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "bcryptjs", "postgres"],
  outputFileTracingIncludes: {
    "/*": ["Veri Merkezi/kategoriagaci.db"],
  },
};

export default nextConfig;
