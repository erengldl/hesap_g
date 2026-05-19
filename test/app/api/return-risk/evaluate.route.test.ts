import { beforeEach, describe, expect, it, vi } from "vitest";

const { evaluateReturnRiskModel } = vi.hoisted(() => ({
  evaluateReturnRiskModel: vi.fn(),
}));

vi.mock("@/lib/return-risk/server", () => ({
  evaluateReturnRiskModel,
}));

import { GET } from "@/app/api/return-risk/evaluate/route";

describe("return risk evaluate route", () => {
  beforeEach(() => {
    evaluateReturnRiskModel.mockReset();
  });

  it("returns fallback status without null payload when no model exists", async () => {
    evaluateReturnRiskModel.mockReturnValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.modelVersion).toBe("not-trained");
    expect(data.data.fallbackActive).toBe(true);
    expect(JSON.stringify(data)).not.toContain("null");
  });
});
