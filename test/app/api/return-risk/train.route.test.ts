import { beforeEach, describe, expect, it, vi } from "vitest";

const { trainReturnRiskModel } = vi.hoisted(() => ({
  trainReturnRiskModel: vi.fn(),
}));

vi.mock("@/lib/return-risk/server", () => ({
  trainReturnRiskModel,
}));

import { POST } from "@/app/api/return-risk/train/route";

describe("return risk train route", () => {
  beforeEach(() => {
    trainReturnRiskModel.mockReset();
  });

  it("returns a fallback-safe payload when data is insufficient", async () => {
    trainReturnRiskModel.mockReturnValue({
      ok: false,
      modelVersion: null,
      modelType: "typescript-logistic-regression",
      trainingRows: 42,
      positiveRows: 4,
      metrics: null,
      reason: "Model egitimi icin en az 300 gecmis siparis gerekli.",
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.ok).toBe(false);
    expect(data.data.modelVersion).toBe("not-trained");
    expect(data.data.fallbackActive).toBe(true);
    expect(JSON.stringify(data)).not.toContain("null");
  });
});
