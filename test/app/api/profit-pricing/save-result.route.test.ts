import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveProfitPricingRun } = vi.hoisted(() => ({
  saveProfitPricingRun: vi.fn(),
}));

vi.mock("@/lib/profit-pricing/server", () => ({
  saveProfitPricingRun,
}));

import { POST } from "@/app/api/profit-pricing/save-result/route";

describe("profit pricing save-result route", () => {
  beforeEach(() => {
    saveProfitPricingRun.mockReset();
  });

  it("returns 400 when input is missing", async () => {
    const response = await POST(
      new Request("http://localhost/api/profit-pricing/save-result", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.ok).toBe(false);
  });

  it("recomputes on the server helper before returning success", async () => {
    saveProfitPricingRun.mockReturnValue({
      runId: "run-1",
      result: {
        decision: "profitable",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/profit-pricing/save-result", {
        method: "POST",
        body: JSON.stringify({
          input: {
            productId: "1",
            channel: "trendyol",
            salePrice: 100,
            productCost: 40,
          },
          note: "Kaydet",
        }),
        headers: { "Content-Type": "application/json" },
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(saveProfitPricingRun).toHaveBeenCalledWith({
      input: {
        productId: "1",
        channel: "trendyol",
        salePrice: 100,
        productCost: 40,
      },
      note: "Kaydet",
    });
    expect(data.ok).toBe(true);
    expect(data.runId).toBe("run-1");
  });
});
