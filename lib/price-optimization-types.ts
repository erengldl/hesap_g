import type { Marketplace, Product } from "@/lib/types";

export type ConfidenceScore = "Low" | "Medium" | "High";
export type RiskLevel = "Low" | "Medium" | "High";
export type PriceOptimizationRunStatus = "DRAFT" | "PUBLISHED";

export interface PriceOptimizationPublishResult {
  skipped: boolean;
  success?: boolean;
  reason?: string;
  error?: string;
  data?: unknown;
}

export interface PriceOptimizationInput {
  productId: number;
  marketplaceId: number;
  minPrice: number;
  maxPrice: number;
  currentSalesVolume: number;
  stock: number;
  elasticityEstimate?: number | null;
}

export interface PriceOptimizationScenarioPoint {
  price: number;
  expected_demand: number;
  unit_profit: number;
  total_profit: number;
  revenue: number;
  is_optimum: boolean;
  total_unit_cost?: number;
  commission_cost?: number;
  estimated_vat_payable?: number;
}

export interface PriceOptimizationScenarioRow {
  label: string;
  test_price: number;
  expected_sales: number;
  unit_profit: number;
  total_profit: number;
  risk_level: RiskLevel;
}

export interface PriceOptimizationResult {
  run_id?: string;
  run_status?: PriceOptimizationRunStatus;
  product_id: number;
  marketplace_id: number;
  product: Product;
  marketplace: Marketplace;
  current_price: number;
  recommended_price: number;
  min_price_limit: number;
  max_price_limit: number;
  expected_demand_current: number;
  expected_demand_recommended: number;
  expected_profit_current: number;
  expected_profit_recommended: number;
  current_unit_cost: number;
  current_unit_profit: number;
  current_commission_cost?: number;
  current_estimated_vat_payable?: number;
  current_sales_volume: number;
  stock: number;
  elasticity_estimate: number;
  confidence_score: ConfidenceScore;
  profit_change_percent: number | null;
  demand_change_percent: number | null;
  current_point: PriceOptimizationScenarioPoint;
  recommended_point: PriceOptimizationScenarioPoint;
  recommended_commission_cost?: number;
  recommended_estimated_vat_payable?: number;
  scenario_data: PriceOptimizationScenarioPoint[];
  scenario_table: PriceOptimizationScenarioRow[];
  generated_at: string;
}

export interface PriceOptimizationBootstrapResponse {
  products: Product[];
  marketplaces: Marketplace[];
  defaults: PriceOptimizationInput;
  currentPrice: number;
  currentUnitCost: number;
}

export interface PriceOptimizationRunSummary {
  run_id: string;
  product_id: number;
  marketplace_id: number;
  product_name: string;
  marketplace_name: string;
  status: PriceOptimizationRunStatus;
  current_price: number;
  recommended_price: number;
  expected_profit_current: number;
  expected_profit_recommended: number;
  confidence_score: ConfidenceScore;
  created_at: string;
  published_at: string | null;
  profit_change_percent: number | null;
}

export interface PriceOptimizationRunListResponse {
  success: boolean;
  runs: PriceOptimizationRunSummary[];
  error?: string;
}

export interface PriceOptimizationApiResponse extends PriceOptimizationBootstrapResponse {
  success: boolean;
  error?: string;
  result: PriceOptimizationResult | null;
  run_id?: string;
  warning?: string;
}

export interface PriceOptimizationPublishResponse {
  success: boolean;
  error?: string;
  run_id?: string;
  status?: PriceOptimizationRunStatus;
  published_at?: string | null;
  publish_result?: PriceOptimizationPublishResult | null;
  warning?: string;
}
