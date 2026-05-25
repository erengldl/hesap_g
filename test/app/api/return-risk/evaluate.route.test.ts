import { beforeEach, describe, expect, it, vi } from "vitest";

const { evaluateReturnRiskModel, requireAuthMock } = vi.hoisted(() => ({
  evaluateReturnRiskModel: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/return-risk/server", () => ({
  evaluateReturnRiskModel,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { GET } from "@/app/api/return-risk/evaluate/route";

describe("return risk evaluate route", () => {
  beforeEach(() => {
    evaluateReturnRiskModel.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Pro",
    });
  });

  it("returns fallback status without null payload when no model exists", async () => {
    evaluateReturnRiskModel.mockReturnValue(null);

    const response = await GET(new Request("http://localhost/api/return-risk/evaluate"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.data.modelVersion).toBe("not-trained");
    expect(data.data.fallbackActive).toBe(true);
    expect(JSON.stringify(data)).not.toContain("null");
  });
});
