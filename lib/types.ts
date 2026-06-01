export interface Product {
  id: number;
  name: string;
  sku?: string;
  barcode?: string;
  image_url?: string;
  category_id?: number;
  category_name?: string;
  category_path?: string;
  description?: string;
  profile_id?: number;
  cost: number;
  packaging_cost: number;
  desi: number;
  sale_price: number;
  stock?: number;
  active_channels: string[]; // ['trendyol', 'hepsiburada', 'my_website']
  status?: 'active' | 'passive' | 'draft' | string;
  status_label?: string;
  profit_margin_percent?: number;
  last_updated?: string;
}

export interface ProductUpsertInput {
  name: string;
  sku?: string;
  barcode?: string;
  image_url?: string;
  category_id: number | null;
  category_path: string;
  description?: string;
  cost: number;
  packaging_cost: number;
  desi: number;
  sale_price: number;
  active_channels: string[];
  status: 'active' | 'passive' | 'draft';
}

export interface Marketplace {
  id: number;
  name: string;
  slug: string;
  base_url?: string;
}

export interface StoreExpense {
  expense_id: number;
  profile_id?: number;
  name: string;
  monthly_amount: number;
  note?: string | null;
  status?: 'active' | 'passive' | 'draft' | string;
}

export interface StoreExpenseUpsertInput {
  name: string;
  monthly_amount: number;
  note?: string;
  status: 'active' | 'passive' | 'draft';
}

export interface Category {
  id: number;
  name: string;
  parent_id?: number;
  path?: string;
}

export interface ShippingCompany {
  id: number;
  name: string;
}

export interface ChannelCostResult {
  channel_name: string;
  marketplace_id?: number;
  marketplace_name?: string;
  marketplace_slug?: string;
  shipping_company_id?: number | null;
  shipping_company_name?: string | null;
  payment_gateway_rule_id?: number | null;
  shipping_mode?: string | null;
  manual_shipping_cost?: number | null;
  sale_price: number;
  product_cost: number;
  packaging_cost: number;
  shipping_cost: number;
  commission_cost: number;
  platform_fee_cost: number;
  payment_gateway_cost: number;
  traffic_ad_cost: number;
  unit_ad_cost: number;
  unit_fixed_cost: number;
  expected_return_cost: number;
  total_unit_cost: number;
  net_profit: number;
  profit_margin_percent: number;
  output_vat: number;
  input_vat: number;
  estimated_vat_payable: number;
  shipping_vat?: number;
  income_tax?: number;
  withholding_tax?: number;
  ml_return_rate?: number;
  ml_predicted_return_cost?: number;
  ml_predicted_cpa?: number;
  ml_shipping_multiplier?: number;
  ml_effective_shipping_cost?: number;
  ml_effective_desi?: number;
  ml_confidence?: "Low" | "Medium" | "High";
  ml_notes?: string | null;
  ml_model_source?: string | null;
  /** For "Kendi Websitem": net profit WITHOUT traffic cost (theoretical commission advantage) */
  gross_net_profit_without_traffic?: number;
  gross_margin_without_traffic?: number;
  is_fallback?: boolean;
  warning_notes?: string | null;
}

export interface CostBreakdown {
  label: string;
  value: number;
  color?: string;
}

export interface PriceScenario {
  price: number;
  estimated_demand: number;
  revenue: number;
  total_cost: number;
  net_profit: number;
  profit_margin: number;
  status: 'recommended' | 'normal' | 'low_profit' | 'loss';
}

export interface DemandForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
  confidence_low?: number;
  confidence_high?: number;
}

export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  sales: number;
  revenue: number;
  roas: number;
  cpc: number;
  cpa: number;
  ctr: number;
  conversion_rate: number;
  unit_ad_cost: number;
}

export interface ReportSummary {
  product_name: string;
  best_channel: string;
  recommendation: string;
  risks: string[];
  opportunities: string[];
}

export interface DataStatus {
  table_name: string;
  count: number;
  status: 'healthy' | 'warning' | 'error';
  last_updated?: string;
}

export interface SellerProfile {
  profile_id?: number;
  company_type: string;
  monthly_employee_cost: number;
  monthly_warehouse_cost: number;
  monthly_invoice_accounting_cost: number;
  monthly_other_expenses: number;
  expected_monthly_order_count: number;
  unit_fixed_cost: number;
  tax_bracket?: number;
}

export interface OwnWebsiteSettings {
  gateway_name: string;
  commission_rate: number;
  fixed_fee: number;
  manual_shipping_cost: number;
  include_kdv: boolean;
  avg_ad_cost: number;
  avg_conversion_rate: number;
}
