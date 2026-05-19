import { describe, expect, it } from "vitest";

import { buildChannelComparison } from "@/lib/profit-pricing/channel-comparison";
import { createBaseProfitPricingInput, createChannelProfiles } from "@/test/lib/profit-pricing/fixtures";

describe("profit pricing channel comparison", () => {
  it("produces different profits for channels with different commission profiles", () => {
    const items = buildChannelComparison(createBaseProfitPricingInput(), createChannelProfiles());
    const trendyol = items.find((item) => item.channel === "trendyol");
    const website = items.find((item) => item.channel === "website");

    expect(trendyol?.netProfit).not.toBe(website?.netProfit);
  });

  it("identifies the most profitable channel correctly", () => {
    const items = buildChannelComparison(createBaseProfitPricingInput(), createChannelProfiles());
    const mostProfitable = items.reduce((best, current) =>
      current.netProfit > best.netProfit ? current : best
    );

    expect(mostProfitable.channel).toBe("website");
  });

  it("marks loss-making channels correctly", () => {
    const items = buildChannelComparison(
      createBaseProfitPricingInput({ salePrice: 70, channel: "trendyol" }),
      createChannelProfiles()
    );
    const trendyol = items.find((item) => item.channel === "trendyol");

    expect(trendyol?.decision).toBe("loss");
  });

  it("uses the live selected channel price instead of stale profile data", () => {
    const items = buildChannelComparison(
      createBaseProfitPricingInput({ salePrice: 140, channel: "trendyol" }),
      createChannelProfiles()
    );
    const trendyol = items.find((item) => item.channel === "trendyol");

    expect(trendyol?.currentPrice).toBe(140);
  });
});
