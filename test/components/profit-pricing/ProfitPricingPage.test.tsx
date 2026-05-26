import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfitPricingPage from "@/components/profit-pricing/ProfitPricingPage";
import { createProfitPricingBootstrap } from "@/test/lib/profit-pricing/fixtures";

vi.mock("@/components/profit-pricing/CostBreakdownChart", () => ({
  default: () => <div>CostBreakdownChart</div>,
}));

vi.mock("@/components/profit-pricing/PriceProfitCurve", () => ({
  default: () => <div>PriceProfitCurve</div>,
}));

vi.mock("@/components/profit-pricing/ChannelProfitChart", () => ({
  default: () => <div>ChannelProfitChart</div>,
}));

describe("ProfitPricingPage UI behavior", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.includes("/api/profit-pricing/recent")) {
          return new Response(JSON.stringify({ ok: true, data: [] }), { status: 200 });
        }

        if (url.includes("/api/profit-pricing/save-result")) {
          return new Response(
            JSON.stringify({
              ok: true,
              runId: "run-1",
              message: "Sonuç kaydedildi. Bu analiz ürün geçmişine eklendi.",
            }),
            { status: 200 }
          );
        }

        throw new Error(`Unhandled fetch call: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates net profit in the UI when sale price changes", async () => {
    const bootstrap = createProfitPricingBootstrap();
    render(<ProfitPricingPage bootstrap={bootstrap} />);

    const salePriceInputs = screen.getAllByLabelText("Satış fiyatı");
    const salePriceInput = salePriceInputs[0];
    const initialNetProfitBlocks = screen
      .getAllByText("Net kâr")
      .map((label) => label.parentElement?.textContent ?? "");
    fireEvent.change(salePriceInput, { target: { value: "130" } });
    await waitFor(() => {
      const nextNetProfitBlocks = screen
        .getAllByText("Net kâr")
        .map((label) => label.parentElement?.textContent ?? "");

      expect(
        nextNetProfitBlocks.some((value, index) => value !== initialNetProfitBlocks[index])
      ).toBe(true);
    }, { timeout: 3000 });
  });

  it("renders the product selector and optimize button", async () => {
    const bootstrap = createProfitPricingBootstrap();
    render(<ProfitPricingPage bootstrap={bootstrap} />);

    expect(screen.getByLabelText("Ürün seç")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Fiyatları Optimize Et" })).not.toBeNull();
  });

  it("renders sales price and buybox/website shipping inputs", () => {
    const bootstrap = createProfitPricingBootstrap();
    render(<ProfitPricingPage bootstrap={bootstrap} />);

    expect(screen.getAllByLabelText("Satış fiyatı").length).toBeGreaterThan(0);
    // Each channel card renders either buybox or kargo input
    expect(screen.getAllByLabelText(/Buybox fiyatı|Kargo fiyatı/).length).toBeGreaterThan(0);
  });

  it("renders channel cards with profit metrics", () => {
    const bootstrap = createProfitPricingBootstrap();
    render(<ProfitPricingPage bootstrap={bootstrap} />);

    // Each channel card shows net profit metric
    const netProfitLabels = screen.getAllByText("Net kâr");
    expect(netProfitLabels.length).toBeGreaterThanOrEqual(1);
  });
});
