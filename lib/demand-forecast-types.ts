import type { Marketplace, Product } from "./types";

export type ForecastHorizon = 7 | 14 | 30;

export type ForecastRiskLevel = "Low" | "Medium" | "High";

export type ForecastDataSource = "real" | "mixed" | "synthetic";

export interface DemandForecastSelection {
  productId: number;
  marketplaceId: number;
  horizonDays: ForecastHorizon;
}

export interface ForecastProductOption extends Product {
  current_stock: number;
  current_sales_volume: number;
  current_unit_cost: number;
  current_net_profit: number;
  confidence_score: string;
  stock_status: "healthy" | "tight" | "critical";
}

export interface ForecastMarketplaceOption extends Marketplace {
  current_price: number;
  current_unit_cost: number;
  current_net_profit: number;
  stock_status: "healthy" | "tight" | "critical";
}

export interface DemandForecastChartPoint {
  date: string;
  label: string;
  actual_units: number | null;
  forecast_units: number | null;
  corrected_units: number | null;
  lower_bound: number | null;
  upper_bound: number | null;
  band_span: number | null;
  projected_stock: number | null;
  is_forecast: boolean;
  is_censored: boolean;
}

export interface DemandForecastTableRow {
  date: string;
  label: string;
  predicted_units: number;
  lower_bound: number;
  upper_bound: number;
  revenue: number;
  projected_stock: number;
  risk_level: ForecastRiskLevel;
  is_forecast: boolean;
}

export interface DemandForecastSummary {
  horizonDays: ForecastHorizon;
  historyWindowDays: number;
  historyDays: number;
  currentStock: number;
  currentSalesVolume: number;
  currentPrice: number;
  currentUnitCost: number;
  unitNetProfit: number;
  totalForecastUnits: number;
  monthlyDemand: number;
  expectedRevenue: number;
  expectedNetProfit: number;
  wmape: number;
  confidenceScore: "Low" | "Medium" | "High";
  modelName: string;
  confidenceMethod: string;
  forecastStartDate: string;
  forecastEndDate: string;
  stockWarning: string;
  dataSource: ForecastDataSource;
  isSyntheticHistory: boolean;
}

export interface DemandForecastResult {
  product: Product;
  marketplace: Marketplace;
  selection: DemandForecastSelection;
  summary: DemandForecastSummary;
  chartData: DemandForecastChartPoint[];
  tableRows: DemandForecastTableRow[];
  methodology: string;
  warnings: string[];
  generatedAt: string;
}

export interface DemandForecastBootstrapResponse {
  products: ForecastProductOption[];
  marketplaces: ForecastMarketplaceOption[];
  horizons: ForecastHorizon[];
  defaults: DemandForecastSelection;
  selectedProduct: ForecastProductOption;
  selectedMarketplace: ForecastMarketplaceOption;
  result: DemandForecastResult;
  historyDepthDays: number;
  warnings: string[];
  methodology: string;
}

export interface DemandForecastRequest extends DemandForecastSelection {
  currentSalesVolume?: number;
  currentStock?: number;
  persist?: boolean;
}

export interface DemandForecastApiResponse extends DemandForecastBootstrapResponse {
  success: true;
  partial?: boolean;
  fallbackUsed?: boolean;
  staleAt?: string | null;
}

export interface DemandForecastRunResponse {
  success: true;
  result: DemandForecastResult;
  savedRows: number;
  warnings: string[];
  partial?: boolean;
  fallbackUsed?: boolean;
  staleAt?: string | null;
}
