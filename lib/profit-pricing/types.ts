import type { ReturnRiskContext, ReturnRiskPrediction } from "@/lib/return-risk/types";

export const SUPPORTED_SALES_CHANNELS = ["trendyol", "hepsiburada", "website"] as const;

export const ALL_SALES_CHANNELS = [
  "trendyol",
  "hepsiburada",
  "website",
  "amazon",
  "general_marketplace",
] as const;

export type SalesChannel = (typeof ALL_SALES_CHANNELS)[number];

export type ProfitDecision =
  | "profitable"
  | "profitable_but_low_margin"
  | "borderline"
  | "loss"
  | "missing_data";

export type DataQuality = "high" | "medium" | "low";

export type CostBreakdownGroup =
  | "product"
  | "channel"
  | "operation"
  | "growth"
  | "tax"
  | "fixed";

export type ScenarioRisk = "low" | "medium" | "high";

export type ProfitPricingDataSource = "product" | "manual" | "mixed";

export const EDITABLE_PROFIT_PRICING_FIELDS = [
  "salePrice",
  "buyboxPrice",
  "shippingCost",
] as const;

export type EditableProfitPricingField = (typeof EDITABLE_PROFIT_PRICING_FIELDS)[number];

export interface ProfitPricingInput {
  productId?: string;
  productName?: string;
  channel: SalesChannel;
  salePrice: number;
  productCost: number;
  packagingCost?: number;
  shippingCost?: number;
  commissionRate?: number;
  platformFee?: number;
  adCostPerOrder?: number;
  buyboxPrice?: number;
  returnRate?: number;
  returnCostPerOrder?: number;
  returnRiskCost?: number;
  returnRiskContext?: ReturnRiskContext;
  fixedCostShare?: number;
  vatRate?: number;
  withholdingRate?: number;
  incomeTaxRate?: number;
  targetMargin?: number;
  baseDemand?: number;
  basePrice?: number;
  demandElasticity?: number;
  stockLimit?: number;
  dataSource?: ProfitPricingDataSource;
}

export interface CostBreakdownItem {
  key: string;
  label: string;
  group: CostBreakdownGroup;
  amount: number;
  percentageOfSalePrice: number | null;
  isVariableWithPrice: boolean;
  formula: string;
  description: string;
}

export interface PriceScenario {
  key: string;
  label: string;
  price: number;
  netCost: number;
  netProfit: number;
  profitMargin: number | null;
  returnRiskCost: number;
  returnRiskPrediction?: ReturnRiskPrediction;
  estimatedDemand?: number | null;
  estimatedTotalProfit?: number | null;
  risk: ScenarioRisk;
  decision: ProfitDecision;
  notes: string[];
}

export interface RecommendedPriceRange {
  min: number;
  max: number;
  preferred: number;
  reason: string;
}

export interface ChannelComparisonItem {
  channel: SalesChannel;
  currentPrice: number;
  netCost: number;
  netProfit: number;
  profitMargin: number | null;
  estimatedDemand: number | null;
  estimatedTotalProfit: number | null;
  breakEvenPrice: number;
  maxProfitableAdCost: number | null;
  recommendedPriceRange: RecommendedPriceRange | null;
  decision: ProfitDecision;
  shortRecommendation: string;
}

export interface ProfitPricingSummary {
  title: string;
  reason: string;
  action: string;
}

export interface ProfitPricingResult {
  input: ProfitPricingInput;
  netCost: number;
  netProfit: number;
  profitMargin: number | null;
  breakEvenPrice: number;
  targetMarginPrice: number | null;
  maxProfitableAdCost: number | null;
  decision: ProfitDecision;
  dataQuality: DataQuality;
  missingFields: string[];
  assumptions: string[];
  warnings: string[];
  costBreakdown: CostBreakdownItem[];
  priceGrid: PriceGridPoint[];
  priceScenarios: PriceScenario[];
  recommendedPriceRange: RecommendedPriceRange | null;
  channelComparison?: ChannelComparisonItem[];
  summary: ProfitPricingSummary;
}

export interface ProfitPricingValidationResult {
  ok: boolean;
  errors: string[];
  missingFields: string[];
  assumptions: string[];
  warnings: string[];
  hasBlockingMissingData: boolean;
}

export interface ProfitPricingChannelProfile {
  channel: SalesChannel;
  label: string;
  input: ProfitPricingInput;
  marketplaceId?: number | null;
  marketplaceSlug?: string | null;
}

export interface ProfitPricingBootstrapProduct {
  id: string;
  label: string;
  sku?: string;
  channels: SalesChannel[];
}

export interface ProfitPricingBootstrap {
  products: ProfitPricingBootstrapProduct[];
  channelProfiles: ProfitPricingChannelProfile[];
  initialInput: ProfitPricingInput;
  initialResult: ProfitPricingResult;
}

export interface CostCalculationComponents {
  productCost: number;
  packagingCost: number;
  shippingCost: number;
  shippingVat: number;
  commission: number;
  platformFee: number;
  adCost: number;
  returnRiskCost: number;
  fixedCostShare: number;
  vat: number;
  withholding: number;
  incomeTax: number;
}

export interface CostCalculationResult {
  price: number;
  components: CostCalculationComponents;
  subtotalBeforeIncomeTax: number;
  total: number;
  netProfit: number;
  profitMargin: number | null;
}

export interface PriceGridPoint {
  price: number;
  netCost: number;
  netProfit: number;
  profitMargin: number | null;
  returnRiskCost: number;
  returnRiskPrediction?: ReturnRiskPrediction;
  estimatedDemand: number | null;
  estimatedTotalProfit: number | null;
}

export const PROFIT_THRESHOLDS = {
  borderlineMargin: 0.1,
  healthyMargin: 0.2,
  minimumHealthyMargin: 0.1,
} as const;
