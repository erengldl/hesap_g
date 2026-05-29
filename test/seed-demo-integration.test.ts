import { describe, it } from "vitest";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { ensureDemoData } from "../lib/seed-demo-data";

describe("Seed Demo Integration Test", () => {
  it("runs ensureDemoData to diagnose seed demo failures", async () => {
    try {
      console.log("Starting ensureDemoData with DB URL:", process.env.DATABASE_URL?.substring(0, 30) + "...");
      const result = await ensureDemoData("test-user-diagnose-id");
      console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Diagnosis Error:", error);
      throw error;
    }
  });
});
