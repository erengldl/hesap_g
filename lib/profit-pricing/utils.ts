import type {
  ProfitDecision,
  ProfitPricingInput,
  SalesChannel,
} from "./types";

export function roundCurrency(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

export function roundQuantity(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 1000) / 1000;
}

export function toFiniteNumber(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function toOptionalFinite(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : undefined;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function safeDivide(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

export function isSupportedSalesChannel(value: string): value is SalesChannel {
  return value === "trendyol" || value === "hepsiburada" || value === "website";
}

export function channelLabel(channel: SalesChannel) {
  switch (channel) {
    case "trendyol":
      return "Trendyol";
    case "hepsiburada":
      return "Hepsiburada";
    case "website":
      return "Web Sitesi";
    case "amazon":
      return "Amazon";
    case "general_marketplace":
      return "Genel Pazaryeri";
    default:
      return channel;
  }
}

export function mapMarketplaceSlugToSalesChannel(slug: string | null | undefined) {
  if (!slug) return null;
  if (slug === "own_website" || slug === "own-website" || slug === "website") {
    return "website" as const;
  }
  if (slug === "trendyol" || slug === "hepsiburada") {
    return slug;
  }
  return null;
}

export function mapSalesChannelToMarketplaceSlug(channel: SalesChannel) {
  if (channel === "website") {
    return "own_website";
  }

  return channel;
}

export function decisionLabel(decision: ProfitDecision) {
  switch (decision) {
    case "profitable":
      return "Kârlı";
    case "profitable_but_low_margin":
      return "Kârlı ama marj düşük";
    case "borderline":
      return "Sınırda";
    case "loss":
      return "Zararda";
    case "missing_data":
      return "Veri Eksik";
    default:
      return decision;
  }
}

export function applyEditableProfitPricingOverrides(
  baseInput: ProfitPricingInput,
  overrides: Partial<ProfitPricingInput>
) {
  return {
    ...baseInput,
    salePrice: overrides.salePrice ?? baseInput.salePrice,
    shippingCost:
      overrides.shippingCost !== undefined ? overrides.shippingCost : baseInput.shippingCost,
    buyboxPrice:
      overrides.buyboxPrice !== undefined ? overrides.buyboxPrice : baseInput.buyboxPrice,
  };
}
