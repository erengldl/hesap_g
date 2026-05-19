export type MarketplaceSlug = "trendyol" | "hepsiburada";

export type MarketplaceConnectionState = "connected" | "disconnected" | "degraded";

export interface MarketplaceIntegrationStatusItem {
  marketplace_id: number;
  marketplace_slug: MarketplaceSlug;
  marketplace_name: string;
  merchant_id: string | null;
  is_active: boolean;
  has_credentials: boolean;
  connection_state: MarketplaceConnectionState;
  api_key_masked?: string | null;
  last_sync_time?: string | null;
  last_sync_scope?: string | null;
  last_error?: string | null;
}

export interface MarketplaceIntegrationStatusResponse {
  success: boolean;
  marketplaces: MarketplaceIntegrationStatusItem[];
  generated_at: string;
}

export interface MarketplaceCredentialUpsertRequest {
  marketplace_slug: MarketplaceSlug;
  merchant_id: string;
  api_key?: string | null;
  api_secret?: string | null;
  is_active?: boolean;
}

export interface MarketplacePriceUpdateItem {
  product_id?: number | null;
  marketplace_id?: number | null;
  sku?: string | null;
  barcode?: string | null;
  merchant_sku?: string | null;
  hepsiburada_sku?: string | null;
  quantity?: number | null;
  sale_price: number;
  list_price?: number | null;
}

export interface MarketplacePricePushRequest {
  marketplace_slug: MarketplaceSlug;
  items?: MarketplacePriceUpdateItem[] | null;
}

export interface MarketplaceSyncRequest {
  marketplace_slug: MarketplaceSlug;
  scope?: "orders" | "settlements" | "full";
  lookback_days?: number;
  start_date?: string | null;
  end_date?: string | null;
  publish_price_updates?: boolean;
  price_updates?: MarketplacePriceUpdateItem[] | null;
}

export interface MarketplaceSyncResponse {
  success: boolean;
  marketplace_slug: MarketplaceSlug;
  scope: string;
  orders_synced: number;
  order_items_synced: number;
  settlements_synced: number;
  cost_snapshots_updated: number;
  price_updates_sent: number;
  warnings: string[];
  last_sync_time?: string | null;
}

export interface MarketplacePricePushResponse {
  success: boolean;
  marketplace_slug: MarketplaceSlug;
  price_updates_sent: number;
  warnings: string[];
  last_sync_time?: string | null;
}
