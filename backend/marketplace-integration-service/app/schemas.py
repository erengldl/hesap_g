from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class MarketplaceCredentialUpsertRequest(BaseModel):
    marketplace_slug: Literal["trendyol", "hepsiburada"]
    merchant_id: str = Field(min_length=1)
    api_key: str | None = None
    api_secret: str | None = None
    is_active: bool = True


class MarketplaceCredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    marketplace_id: int
    marketplace_slug: str
    marketplace_name: str
    merchant_id: str | None
    is_active: bool
    has_credentials: bool
    connection_state: Literal["connected", "disconnected", "degraded"]
    api_key_masked: str | None = None
    last_sync_time: datetime | None = None
    last_sync_scope: str | None = None
    last_error: str | None = None


class MarketplaceStatusResponse(BaseModel):
    success: bool = True
    marketplaces: list[MarketplaceCredentialRead] = Field(default_factory=list)
    generated_at: datetime


class ProductImageUploadResponse(BaseModel):
    success: bool = True
    url: str
    fileName: str


class MarketplaceSyncQueuedResponse(BaseModel):
    success: bool = True
    queued: bool = True
    marketplace_slug: str
    scope: str
    message: str
    scheduled_at: datetime


class PriceUpdateItem(BaseModel):
    product_id: int | None = None
    marketplace_id: int | None = None
    sku: str | None = None
    barcode: str | None = None
    merchant_sku: str | None = None
    hepsiburada_sku: str | None = None
    quantity: int | None = None
    sale_price: float = Field(gt=0)
    list_price: float | None = None


class MarketplacePricePushRequest(BaseModel):
    marketplace_slug: Literal["trendyol", "hepsiburada"]
    items: list[PriceUpdateItem] | None = None


class MarketplaceSyncRequest(BaseModel):
    marketplace_slug: Literal["trendyol", "hepsiburada"]
    scope: Literal["orders", "settlements", "full"] = "full"
    lookback_days: int = Field(default=14, ge=1, le=14)
    start_date: datetime | None = None
    end_date: datetime | None = None
    publish_price_updates: bool = True
    price_updates: list[PriceUpdateItem] | None = None


class MarketplaceSyncResponse(BaseModel):
    success: bool = True
    marketplace_slug: str
    scope: str
    orders_synced: int = 0
    order_items_synced: int = 0
    settlements_synced: int = 0
    cost_snapshots_updated: int = 0
    price_updates_sent: int = 0
    warnings: list[str] = Field(default_factory=list)
    last_sync_time: datetime | None = None


class MarketplacePricePushResponse(BaseModel):
    success: bool = True
    marketplace_slug: str
    price_updates_sent: int = 0
    warnings: list[str] = Field(default_factory=list)
    last_sync_time: datetime | None = None


class MarketplaceCatalogImportRequest(BaseModel):
    marketplace_slug: Literal["trendyol", "hepsiburada", "all"] = "all"


class MarketplaceCatalogImportResponse(BaseModel):
    success: bool = True
    marketplace_slug: str = "all"
    marketplaces_processed: list[str] = Field(default_factory=list)
    products_created: int = 0
    products_updated: int = 0
    products_unchanged: int = 0
    settings_upserted: int = 0
    inventory_rows_upserted: int = 0
    warnings: list[str] = Field(default_factory=list)
    last_sync_time: datetime | None = None


PricePushResponse = MarketplacePricePushResponse
