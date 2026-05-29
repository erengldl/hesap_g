from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class MarketplaceCredential(Base):
    __tablename__ = "marketplace_credentials"
    __table_args__ = (UniqueConstraint("marketplace_id", name="uq_marketplace_credentials_marketplace"),)

    credential_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    marketplace_id: Mapped[int] = mapped_column(ForeignKey("marketplaces.marketplace_id"), nullable=False)
    merchant_id: Mapped[str] = mapped_column(String, nullable=False)
    encrypted_api_key: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_api_secret: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="1")
    last_sync_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_sync_scope: Mapped[str | None] = mapped_column(String, nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())


class MarketplaceOrder(Base):
    __tablename__ = "orders"
    __table_args__ = ()

    order_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.product_id"), nullable=False)
    marketplace_id: Mapped[int] = mapped_column(ForeignKey("marketplaces.marketplace_id"), nullable=False)
    order_date: Mapped[str] = mapped_column(Date, nullable=False)
    quantity: Mapped[float] = mapped_column(nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(nullable=False, default=0)
    status: Mapped[str | None] = mapped_column(String, nullable=True, default="completed")
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    external_order_number: Mapped[str | None] = mapped_column(String, nullable=True)
    external_package_number: Mapped[str | None] = mapped_column(String, nullable=True)
    external_line_item_id: Mapped[str | None] = mapped_column(String, nullable=True)
    merchant_sku: Mapped[str | None] = mapped_column(String, nullable=True)
    barcode: Mapped[str | None] = mapped_column(String, nullable=True)
    buyer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    order_status_detail: Mapped[str | None] = mapped_column(String, nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String, nullable=True, default="TRY")
    gross_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    discount_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    shipping_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    commission_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    realized_commission: Mapped[float] = mapped_column(nullable=False, default=0)
    realized_shipping_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    settlement_transaction_type: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())


class MarketplaceOrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (UniqueConstraint("marketplace_order_number", "external_order_line_id", name="uq_order_items_external_line"),)

    order_item_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.order_id"), nullable=False)
    marketplace_order_number: Mapped[str | None] = mapped_column(String, nullable=True)
    package_number: Mapped[str | None] = mapped_column(String, nullable=True)
    external_order_line_id: Mapped[str | None] = mapped_column(String, nullable=True)
    merchant_sku: Mapped[str | None] = mapped_column(String, nullable=True)
    barcode: Mapped[str | None] = mapped_column(String, nullable=True)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.product_id"), nullable=True)
    quantity: Mapped[float] = mapped_column(nullable=False, default=1)
    unit_price: Mapped[float] = mapped_column(nullable=False, default=0)
    line_total: Mapped[float] = mapped_column(nullable=False, default=0)
    commission_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    shipping_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    transaction_type: Mapped[str | None] = mapped_column(String, nullable=True)
    raw_payload_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.current_timestamp())


class CostResult(Base):
    __tablename__ = "cost_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    marketplace_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    shipping_company_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    list_price: Mapped[float] = mapped_column(nullable=False)
    product_cost: Mapped[float] = mapped_column(nullable=False)
    packaging_cost: Mapped[float] = mapped_column(nullable=False)
    shipping_cost: Mapped[float] = mapped_column(nullable=False)
    commission_cost: Mapped[float] = mapped_column(nullable=False)
    platform_fee_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    payment_gateway_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    unit_ad_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    unit_fixed_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    total_unit_cost: Mapped[float] = mapped_column(nullable=False)
    net_profit: Mapped[float] = mapped_column(nullable=False)
    profit_margin_percent: Mapped[float] = mapped_column(nullable=False)
    calculated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.current_timestamp(), nullable=False)
    shipping_mode: Mapped[str | None] = mapped_column(String, nullable=True)
    manual_shipping_cost: Mapped[float | None] = mapped_column(nullable=True)
    payment_gateway_rule_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warning_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    marketplace_slug: Mapped[str | None] = mapped_column(String, nullable=True)
    marketplace_name: Mapped[str | None] = mapped_column(String, nullable=True)
    expected_return_cost: Mapped[float] = mapped_column(nullable=False, default=0)
    output_vat_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    input_vat_amount: Mapped[float] = mapped_column(nullable=False, default=0)
    estimated_vat_payable: Mapped[float] = mapped_column(nullable=False, default=0)
    realized_commission: Mapped[float] = mapped_column(nullable=False, default=0)
    realized_shipping_cost: Mapped[float] = mapped_column(nullable=False, default=0)
