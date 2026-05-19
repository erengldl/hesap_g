import { describe, expect, it } from "vitest";

import { validateManualAdCampaignInput } from "@/lib/manual-ads/validation";

describe("manual ads validation", () => {
  it("accepts valid campaign input", () => {
    const result = validateManualAdCampaignInput({
      name: "Valid campaign",
      platform: "meta",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      totalSpend: 1500,
      ordersFromAds: 5,
      creativeFormat: "video",
      revenueFromAds: 5000,
      productName: "Test product",
      productSalePrice: 800,
      estimatedProductCost: 400,
      estimatedProductProfit: 300,
      notes: "Manual notes",
    });

    expect(result.ok).toBe(true);
  });

  it("rejects end date before start date", () => {
    const result = validateManualAdCampaignInput({
      name: "Invalid campaign",
      platform: "meta",
      startDate: "2026-05-05",
      endDate: "2026-05-01",
      totalSpend: 1500,
      ordersFromAds: 5,
      productName: "Test product",
      productSalePrice: 800,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.endDate).toContain("Bitiş tarihi başlangıç tarihinden önce olamaz.");
    }
  });

  it("rejects non-positive spend", () => {
    const result = validateManualAdCampaignInput({
      name: "Invalid campaign",
      platform: "meta",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      totalSpend: 0,
      ordersFromAds: 5,
      productName: "Test product",
      productSalePrice: 800,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.totalSpend).toContain("Toplam harcama 0'dan büyük olmalıdır.");
    }
  });

  it("allows zero orders", () => {
    const result = validateManualAdCampaignInput({
      name: "Zero order campaign",
      platform: "google",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      totalSpend: 1500,
      ordersFromAds: 0,
      productName: "Test product",
      productSalePrice: 800,
    });

    expect(result.ok).toBe(true);
  });

  it("rejects negative revenue and profit fields", () => {
    const result = validateManualAdCampaignInput({
      name: "Invalid economics",
      platform: "tiktok",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      totalSpend: 1500,
      ordersFromAds: 5,
      productName: "Test product",
      revenueFromAds: -10,
      productSalePrice: -1,
      estimatedProductCost: -2,
      estimatedProductProfit: -3,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.revenueFromAds).toContain("Ciro negatif olamaz.");
      expect(result.errors.productSalePrice).toContain("Ürün satış fiyatı negatif olamaz.");
      expect(result.errors.estimatedProductCost).toContain("Ürün başı tahmini maliyet negatif olamaz.");
      expect(result.errors.estimatedProductProfit).toContain("Ürün başı tahmini net kâr negatif olamaz.");
    }
  });

  it("rejects missing product selection", () => {
    const result = validateManualAdCampaignInput({
      name: "Missing product",
      platform: "other",
      startDate: "2026-05-01",
      endDate: "2026-05-05",
      totalSpend: 1500,
      ordersFromAds: 5,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.productName).toContain("İlgili ürün seçilmelidir.");
    }
  });
});
