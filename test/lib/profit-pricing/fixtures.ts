import { buildChannelComparison } from "@/lib/profit-pricing/channel-comparison";
import { calculateProfitPricing } from "@/lib/profit-pricing/orchestrator";
import type {
  ProfitPricingBootstrap,
  ProfitPricingChannelProfile,
  ProfitPricingInput,
} from "@/lib/profit-pricing/types";

export function createBaseProfitPricingInput(
  overrides: Partial<ProfitPricingInput> = {}
): ProfitPricingInput {
  return {
    productId: "1",
    productName: "Test Ürünü",
    channel: "trendyol",
    salePrice: 100,
    productCost: 40,
    packagingCost: 5,
    shippingCost: 10,
    commissionRate: 0.1,
    platformFee: 1,
    adCostPerOrder: 5,
    returnRate: 0.1,
    returnCostPerOrder: 20,
    fixedCostShare: 4,
    vatRate: 0.1,
    withholdingRate: 0.01,
    incomeTaxRate: 0.2,
    targetMargin: 0.15,
    baseDemand: 100,
    basePrice: 100,
    demandElasticity: -1,
    stockLimit: 80,
    dataSource: "manual",
    ...overrides,
  };
}

export function createChannelProfiles(): ProfitPricingChannelProfile[] {
  return [
    {
      channel: "trendyol",
      label: "Trendyol",
      marketplaceId: 1,
      marketplaceSlug: "trendyol",
      input: createBaseProfitPricingInput({
        channel: "trendyol",
        salePrice: 100,
        shippingCost: 10,
        commissionRate: 0.15,
      }),
    },
    {
      channel: "hepsiburada",
      label: "Hepsiburada",
      marketplaceId: 2,
      marketplaceSlug: "hepsiburada",
      input: createBaseProfitPricingInput({
        channel: "hepsiburada",
        salePrice: 100,
        shippingCost: 8,
        commissionRate: 0.12,
      }),
    },
    {
      channel: "website",
      label: "Web Sitesi",
      marketplaceId: 3,
      marketplaceSlug: "my_website",
      input: createBaseProfitPricingInput({
        channel: "website",
        salePrice: 100,
        shippingCost: 12,
        commissionRate: 0,
        platformFee: 0,
      }),
    },
  ];
}

export function createProfitPricingBootstrap(
  inputOverrides: Partial<ProfitPricingInput> = {}
): ProfitPricingBootstrap {
  const input = createBaseProfitPricingInput(inputOverrides);
  const channelProfiles = createChannelProfiles();
  const result = calculateProfitPricing(input);
  result.channelComparison = buildChannelComparison(result.input, channelProfiles);

  return {
    products: [
      {
        id: "1",
        label: "Test Ürünü",
        sku: "SKU-1",
        channels: ["trendyol", "hepsiburada", "website"],
      },
    ],
    channelProfiles,
    initialInput: input,
    initialResult: result,
  };
}
