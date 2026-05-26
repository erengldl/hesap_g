import { beforeEach, describe, expect, it, vi } from "vitest";

const { trainReturnRiskModel, requireAuthMock } = vi.hoisted(() => ({
  trainReturnRiskModel: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/return-risk/server", () => ({
  trainReturnRiskModel,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { POST } from "@/app/api/return-risk/train/route";

describe("return risk train route", () => {
  beforeEach(() => {
    trainReturnRiskModel.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Pro",
    });
  });

  it("returns a fallback-safe payload when data is insufficient", async () => {
    trainReturnRiskModel.mockReturnValue({
      ok: false,
      modelVersion: null,
      modelType: "typescript-logistic-regression",
      trainingRows: 42,
      positiveRows: 4,
      metrics: null,
      reason: "Model eğitimi için en az 300 geçmiş sipariş gerekli.",
    });

    const response = await POST(new Request("http://localhost/api/return-risk/train", { method: "POST" }));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.ok).toBe(false);
    expect(data.data.modelVersion).toBe("not-trained");
    expect(data.data.fallbackActive).toBe(true);
    expect(JSON.stringify(data)).not.toContain("null");
  });
});
