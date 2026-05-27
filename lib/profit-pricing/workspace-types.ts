import type { Marketplace, Product } from "@/lib/types";

export type ProfitPricingTab = "pricing" | "net-cost";

export interface ProductMarketplaceSettingSummary {
  sale_price: number;
  shipping_company_id?: number | null;
  manual_shipping_cost?: number | null;
  payment_gateway_rule_id?: number | null;
  shipping_mode?: string | null;
  traffic_cpa?: number | null;
  marketplace_name?: string | null;
  marketplace_slug?: string | null;
}

export interface NetCostBootstrap {
  products: Product[];
  marketplaces: Marketplace[];
  selectedProduct: Product | null;
  unitFixedCost: number;
  defaultProductSettings: {
    trendyol: ProductMarketplaceSettingSummary | null;
    hepsiburada: ProductMarketplaceSettingSummary | null;
    my_website: ProductMarketplaceSettingSummary | null;
  } | null;
}
