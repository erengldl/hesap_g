import { beforeEach, describe, expect, it, vi } from "vitest";

const { applyProfitPricingRun, requireAuthMock } = vi.hoisted(() => ({
  applyProfitPricingRun: vi.fn(),
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/profit-pricing/server", () => ({
  applyProfitPricingRun,
}));

vi.mock("@/lib/api-auth", () => ({
  requireAuth: requireAuthMock,
}));

import { POST } from "@/app/api/profit-pricing/apply-price/route";

describe("profit pricing apply-price route", () => {
  beforeEach(() => {
    applyProfitPricingRun.mockReset();
    requireAuthMock.mockResolvedValue({
      userId: 1,
      email: "demo@example.com",
      name: "Demo User",
      plan: "Pro",
    });
  });

  it("rejects missing run ids", async () => {
    const response = await POST(
      new Request("http://localhost/api/profit-pricing/apply-price", {
        method: "POST",
        body: JSON.stringify({ confirmed: true }),
        headers: { "Content-Type": "application/json" },
      })
    );

    expect(response.status).toBe(400);
  });

  it("rejects unconfirmed price apply attempts", async () => {
    const response = await POST(
      new Request("http://localhost/api/profit-pricing/apply-price", {
        method: "POST",
        body: JSON.stringify({ runId: "run-1", confirmed: false }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("kullanıcı onayı");
    expect(applyProfitPricingRun).not.toHaveBeenCalled();
  });

  it("applies a price only through the guarded helper", async () => {
    applyProfitPricingRun.mockReturnValue({
      oldPrice: 499,
      newPrice: 549,
      result: { decision: "profitable" },
    });

    const response = await POST(
      new Request("http://localhost/api/profit-pricing/apply-price", {
        method: "POST",
        body: JSON.stringify({ runId: "run-1", confirmed: true, price: 549 }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(applyProfitPricingRun).toHaveBeenCalledWith({
      runId: "run-1",
      confirmed: true,
      price: 549,
    });
    expect(data.ok).toBe(true);
    expect(data.oldPrice).toBe(499);
    expect(data.newPrice).toBe(549);
  });
});
