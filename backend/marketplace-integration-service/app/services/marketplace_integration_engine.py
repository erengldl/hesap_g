from __future__ import annotations

import hashlib
import json
import os
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from typing import Any, Iterable, Literal

import httpx
from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..env import load_environment_files
from ..schemas import (
    MarketplaceCatalogImportRequest,
    MarketplaceCatalogImportResponse,
    MarketplaceCredentialRead,
    MarketplaceCredentialUpsertRequest,
    MarketplacePricePushRequest,
    MarketplacePricePushResponse,
    MarketplaceStatusResponse,
    MarketplaceSyncRequest,
    MarketplaceSyncResponse,
    PriceUpdateItem,
)

load_environment_files()

UTC = timezone.utc
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}
DEFAULT_LOOKBACK_DAYS = 14
DEFAULT_TIMEOUT = httpx.Timeout(30.0, connect=10.0)


class MarketplaceIntegrationError(RuntimeError):
    pass


class RetryableMarketplaceError(MarketplaceIntegrationError):
    pass


class CredentialDecryptionError(MarketplaceIntegrationError):
    pass


def round2(value: float | int | None) -> float:
    return round(float(value or 0), 2)


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def as_utc(dt_value: datetime | None) -> datetime:
    if dt_value is None:
        return now_utc()
    if dt_value.tzinfo is None:
        return dt_value.replace(tzinfo=UTC)
    return dt_value.astimezone(UTC)


def to_iso_day(dt_value: datetime | date) -> str:
    if isinstance(dt_value, date) and not isinstance(dt_value, datetime):
        return dt_value.isoformat()
    return as_utc(dt_value).date().isoformat()


def to_millis(dt_value: datetime) -> int:
    return int(as_utc(dt_value).timestamp() * 1000)


def parse_datetime(value: Any) -> datetime | None:
    if value in (None, "", 0):
        return None
    if isinstance(value, datetime):
        return as_utc(value)
    if isinstance(value, (int, float)):
        if value > 10_000_000_000:
            return datetime.fromtimestamp(value / 1000, tz=UTC)
        return datetime.fromtimestamp(value, tz=UTC)
    text_value = str(value).strip()
    if not text_value:
        return None
    normalized = text_value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
        return as_utc(parsed)
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                parsed = datetime.strptime(text_value, fmt)
                return parsed.replace(tzinfo=UTC)
            except ValueError:
                continue
    return None


def parse_float(value: Any, default: float = 0.0) -> float:
    if value in (None, ""):
        return default
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def parse_int(value: Any, default: int = 0) -> int:
    if value in (None, ""):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def mask_value(value: str | None) -> str | None:
    if not value:
        return None
    if len(value) <= 6:
        return "*" * len(value)
    return f"{value[:3]}***{value[-3:]}"


def stable_hash(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def chunked(items: list[Any], size: int) -> Iterable[list[Any]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


@lru_cache(maxsize=1)
def get_fernet() -> Fernet:
    key = os.getenv("MARKETPLACE_CREDENTIALS_FERNET_KEY", "").strip()
    if not key:
        raise RuntimeError("MARKETPLACE_CREDENTIALS_FERNET_KEY is required to encrypt marketplace credentials.")
    return Fernet(key.encode("utf-8"))


async def fetch_one_mapping(session: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> dict[str, Any] | None:
    result = await session.execute(text(sql), params or {})
    row = result.mappings().first()
    return dict(row) if row is not None else None


async def fetch_all_mappings(session: AsyncSession, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    result = await session.execute(text(sql), params or {})
    return [dict(row) for row in result.mappings().all()]


def normalize_slug(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized in {"own_website", "own-website", "website"}:
        return "own_website"
    return normalized


def infer_marketplace_name(slug: str) -> str:
    return "Trendyol" if slug == "trendyol" else "Hepsiburada"


def ensure_price_item_identity(item: PriceUpdateItem) -> str:
    identity_bits = [
        str(item.product_id or ""),
        str(item.marketplace_id or ""),
        item.sku or "",
        item.barcode or "",
        item.merchant_sku or "",
        item.hepsiburada_sku or "",
        f"{item.sale_price:.2f}",
    ]
    return "|".join(identity_bits)


def first_non_empty(*values: Any) -> Any:
    for value in values:
        if value in (None, ""):
            continue
        return value
    return None


def normalize_import_sku(value: Any, *, uppercase: bool = False) -> str | None:
    if value in (None, ""):
        return None
    normalized = str(value).strip().replace("\n", " ")
    normalized = " ".join(normalized.split())
    if not normalized:
        return None
    return normalized.upper() if uppercase else normalized


def build_category_path(marketplace_name: str, category_name: str | None, category_id: int | None) -> str:
    suffix = category_name or (f"Kategori {category_id}" if category_id else "Katalog")
    return f"{marketplace_name} / {suffix}"


def extract_image_url(payload: dict[str, Any]) -> str | None:
    image_candidates = [
        payload.get("imageUrl"),
        payload.get("image_url"),
        payload.get("defaultImageUrl"),
        payload.get("defaultImageURL"),
        payload.get("mainImageUrl"),
        payload.get("mainImage"),
    ]

    images = payload.get("images") or payload.get("imageList") or payload.get("pictures") or []
    if isinstance(images, list):
        for image in images:
            if isinstance(image, str) and image.strip():
                image_candidates.append(image)
                break
            if isinstance(image, dict):
                image_candidates.extend(
                    [
                        image.get("url"),
                        image.get("imageUrl"),
                        image.get("imageURL"),
                        image.get("mediumUrl"),
                    ]
                )
                break

    for candidate in image_candidates:
        if candidate in (None, ""):
            continue
        if isinstance(candidate, dict):
            nested_url = first_non_empty(
                candidate.get("url"),
                candidate.get("imageUrl"),
                candidate.get("imageURL"),
                candidate.get("src"),
                candidate.get("path"),
                candidate.get("originalUrl"),
            )
            if nested_url not in (None, ""):
                nested_text = str(nested_url).strip()
                if nested_text:
                    return nested_text
            continue
        candidate_text = str(candidate).strip()
        if candidate_text:
            return candidate_text
    return None


def infer_import_status(payload: dict[str, Any], *, default: str = "active") -> str:
    status_parts = [
        str(payload.get("status") or ""),
        str(payload.get("productStatus") or ""),
        str(payload.get("listingStatus") or ""),
        str(payload.get("importStatus") or ""),
        str(payload.get("approvalStatus") or ""),
        str(payload.get("approved") if payload.get("approved") is not None else ""),
    ]
    normalized = " ".join(part.lower() for part in status_parts if part)
    if "false" in normalized or "rejected" in normalized or "blacklist" in normalized or "suspended" in normalized or "inactive" in normalized:
        return "passive"
    if any(
        token in normalized
        for token in (
            "draft",
            "pending",
            "processing",
            "catalog",
            "matched",
            "incelenecek",
            "eksik",
            "waiting",
        )
    ):
        return "draft"
    if "true" in normalized or "approved" in normalized or "salable" in normalized or "active" in normalized or "ready" in normalized:
        return "active"
    return default


def infer_marketplace_product_name(payload: dict[str, Any], fallback: str | None = None) -> str:
    name = first_non_empty(
        payload.get("name"),
        payload.get("productName"),
        payload.get("title"),
        payload.get("description"),
        payload.get("urunAdi"),
        fallback,
    )
    name_text = str(name or "").strip()
    return name_text or "İsimsiz Ürün"


def infer_numeric_value(*values: Any) -> float:
    for value in values:
        if value in (None, ""):
            continue
        if isinstance(value, dict):
            nested = first_non_empty(value.get("amount"), value.get("value"), value.get("price"))
            if nested not in (None, ""):
                try:
                    return parse_float(nested, 0.0)
                except Exception:
                    continue
        try:
            parsed = parse_float(value, 0.0)
            if parsed != 0 or str(value).strip() in {"0", "0.0", "0,0"}:
                return parsed
        except Exception:
            continue
    return 0.0


def normalize_remote_catalog_record(
    marketplace_slug: str,
    payload: dict[str, Any],
    *,
    sku: str | None,
    barcode: str | None,
    fallback_name: str | None = None,
) -> dict[str, Any]:
    marketplace_name = infer_marketplace_name(marketplace_slug)
    category_id = parse_int(first_non_empty(payload.get("categoryId"), payload.get("category_id"), payload.get("category")), 0) or None
    category_name = str(first_non_empty(payload.get("categoryName"), payload.get("category_name"), payload.get("categoryDisplayName")) or "").strip() or None
    desi = infer_numeric_value(
        payload.get("desi"),
        payload.get("deci"),
        payload.get("weight"),
        payload.get("shippingWeight"),
        payload.get("packageWeight"),
    )
    stock = infer_numeric_value(
        payload.get("stock"),
        payload.get("availableStock"),
        payload.get("quantity"),
        payload.get("inventory"),
        payload.get("stockQty"),
    )
    sale_price = infer_numeric_value(
        payload.get("rrpPrice"),
        payload.get("salePrice"),
        payload.get("price"),
        payload.get("listPrice"),
        payload.get("sellingPrice"),
        payload.get("merchantUnitPrice"),
        payload.get("merchantTotalPrice"),
    )
    buying_price = infer_numeric_value(
        payload.get("buyingPrice"),
        payload.get("purchasePrice"),
        payload.get("costPrice"),
        payload.get("merchantCost"),
    )

    if marketplace_slug == "hepsiburada":
        sku = normalize_import_sku(first_non_empty(sku, payload.get("merchantSku"), payload.get("merchantSKU"), payload.get("hbSku")), uppercase=True)
        barcode = normalize_import_sku(first_non_empty(barcode, payload.get("barcode"), payload.get("productBarcode"), payload.get("ean")), uppercase=True)
    else:
        sku = normalize_import_sku(first_non_empty(sku, payload.get("sellerBarcode"), payload.get("stockCode"), payload.get("merchantSku"), payload.get("barcode")))
        barcode = normalize_import_sku(first_non_empty(barcode, payload.get("barcode"), payload.get("sellerBarcode")))

    if not sku:
        sku = barcode

    name = infer_marketplace_product_name(payload, fallback_name or sku or barcode)
    image_url = extract_image_url(payload)
    status = infer_import_status(payload)

    return {
        "sku": sku,
        "barcode": barcode,
        "name": name,
        "image_url": image_url,
        "category_id": category_id,
        "category_name": category_name,
        "category_path": build_category_path(marketplace_name, category_name, category_id),
        "desi": desi,
        "stock": stock,
        "sale_price": sale_price,
        "buying_price": buying_price,
        "status": status,
        "raw_payload": payload,
    }


@dataclass(slots=True)
class CatalogImportSummary:
    created: int = 0
    updated: int = 0
    unchanged: int = 0
    settings_upserted: int = 0
    inventory_rows_upserted: int = 0
    processed: int = 0


@dataclass(slots=True)
class MarketplaceCredentialContext:
    marketplace_id: int
    marketplace_slug: str
    marketplace_name: str
    merchant_id: str
    api_key: str
    api_secret: str
    is_active: bool
    last_sync_time: datetime | None
    last_sync_scope: str | None
    last_error: str | None


class BaseMarketplaceAdapter(ABC):
    base_url: str
    user_agent: str
    price_batch_size: int

    def __init__(self, credential: MarketplaceCredentialContext) -> None:
        self.credential = credential

    def _auth(self) -> httpx.BasicAuth:
        return httpx.BasicAuth(self.credential.api_key, self.credential.api_secret)

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": self.user_agent,
        }

    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=20),
        retry=retry_if_exception_type((RetryableMarketplaceError, httpx.RequestError, httpx.TimeoutException)),
        reraise=True,
    )
    async def _request_response(
        self,
        method: str,
        path: str,
        *,
        base_url: str | None = None,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        headers = self._headers()
        if extra_headers:
            headers.update(extra_headers)

        async with httpx.AsyncClient(
            base_url=(base_url or self.base_url),
            timeout=DEFAULT_TIMEOUT,
            auth=self._auth(),
            headers=headers,
        ) as client:
            response = await client.request(method, path, params=params, json=json_body)
            await response.aread()
            if response.status_code in RETRYABLE_STATUS_CODES:
                raise RetryableMarketplaceError(
                    f"{self.credential.marketplace_slug} returned retryable status {response.status_code} for {path}"
                )
            if response.status_code >= 400:
                raise MarketplaceIntegrationError(
                    f"{self.credential.marketplace_slug} request failed with status {response.status_code}: {response.text}"
                )
            if not response.content:
                return {}
            try:
                return response.json()
            except ValueError as error:
                raise MarketplaceIntegrationError(
                    f"{self.credential.marketplace_slug} returned invalid JSON for {path}"
                ) from error

    async def _request_json(
        self,
        method: str,
        path: str,
        *,
        base_url: str | None = None,
        params: dict[str, Any] | None = None,
        json_body: Any | None = None,
        extra_headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        response = await self._request_response(
            method,
            path,
            base_url=base_url,
            params=params,
            json_body=json_body,
            extra_headers=extra_headers,
        )
        return response

    @abstractmethod
    async def fetch_orders(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_settlements(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    async def push_prices(self, items: list[PriceUpdateItem]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    async def fetch_catalog_products(self) -> list[dict[str, Any]]:
        raise NotImplementedError


class TrendyolAdapter(BaseMarketplaceAdapter):
    base_url = os.getenv("TRENDYOL_API_BASE_URL", "https://apigw.trendyol.com").rstrip("/")
    user_agent = os.getenv("TRENDYOL_USER_AGENT", "HesapG/1.0")
    price_batch_size = 1000

    def _headers(self) -> dict[str, str]:
        headers = super()._headers()
        headers["storeFrontCode"] = os.getenv("TRENDYOL_STOREFRONT_CODE", "TR")
        return headers

    async def fetch_orders(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        cursor: str | None = None
        records: list[dict[str, Any]] = []
        start_ms = to_millis(start_date)
        end_ms = to_millis(end_date)

        while True:
            params: dict[str, Any] = {
                "lastModifiedStartDate": start_ms,
                "lastModifiedEndDate": end_ms,
                "size": 200,
            }
            if cursor:
                params["nextCursor"] = cursor

            payload = await self._request_json(
                "GET",
                f"/integration/order/sellers/{self.credential.merchant_id}/orders/stream",
                params=params,
            )
            content = payload.get("content") or payload.get("items") or []
            if not isinstance(content, list):
                content = []

            for package in content:
                package_number = str(
                    package.get("shipmentPackageId")
                    or package.get("packageNumber")
                    or package.get("shipmentPackageNo")
                    or package.get("id")
                    or ""
                )
                order_number = str(package.get("orderNumber") or package.get("orderId") or package_number or "")
                line_items = (
                    package.get("lines")
                    or package.get("orderLines")
                    or package.get("shipmentPackageItems")
                    or package.get("items")
                    or []
                )
                if not isinstance(line_items, list) or len(line_items) == 0:
                    line_items = [package]

                for index, line in enumerate(line_items):
                    merchant_sku = str(
                        line.get("merchantSku")
                        or line.get("stockCode")
                        or line.get("sku")
                        or line.get("barcode")
                        or package.get("merchantSku")
                        or ""
                    ).strip() or None
                    barcode = str(line.get("barcode") or merchant_sku or "").strip() or None
                    quantity = max(1.0, parse_float(line.get("quantity") or line.get("piece") or 1, 1))
                    unit_price = parse_float(
                        line.get("unitPrice")
                        or line.get("price")
                        or line.get("salePrice")
                        or line.get("linePrice")
                        or package.get("totalPrice"),
                        0,
                    )
                    discount_amount = parse_float(line.get("discount") or line.get("discountAmount") or 0)
                    gross_amount = round2((unit_price * quantity) - discount_amount)
                    line_item_id = str(
                        line.get("shipmentPackageLineItemId")
                        or line.get("lineItemId")
                        or line.get("id")
                        or f"{order_number}-{index}"
                    )
                    buyer_name = str(
                        package.get("customerName")
                        or package.get("buyerName")
                        or package.get("shipmentAddress", {}).get("fullName")
                        or ""
                    ).strip() or None
                    order_date = (
                        parse_datetime(package.get("orderDate"))
                        or parse_datetime(package.get("lastModifiedDate"))
                        or parse_datetime(line.get("orderDate"))
                        or now_utc()
                    )

                    records.append(
                        {
                            "external_order_number": order_number,
                            "external_package_number": package_number,
                            "external_line_item_id": line_item_id,
                            "merchant_sku": merchant_sku,
                            "barcode": barcode,
                            "quantity": quantity,
                            "unit_price": unit_price,
                            "gross_amount": gross_amount,
                            "discount_amount": discount_amount,
                            "shipping_amount": 0.0,
                            "commission_amount": 0.0,
                            "buyer_name": buyer_name,
                            "currency_code": str(line.get("currencyCode") or package.get("currencyCode") or "TRY"),
                            "order_date": order_date,
                            "status": str(package.get("packageStatus") or line.get("status") or "completed"),
                            "status_detail": str(package.get("statusDetail") or line.get("statusDetail") or "").strip() or None,
                            "raw_payload": {"package": package, "line": line},
                        }
                    )

            cursor = payload.get("nextCursor") or payload.get("cursor")
            has_more = bool(payload.get("hasMore") or payload.get("more") or cursor)
            if not content or not has_more:
                break

        return records

    async def fetch_settlements(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        settlement_types = ("SellerRevenuePositive", "SellerRevenueNegative", "CommissionNegative", "CommissionPositive")
        records: list[dict[str, Any]] = []
        page_size = 500

        for settlement_type in settlement_types:
            page = 0
            while True:
                query_params = {
                    "transactionType": settlement_type,
                    "startDate": to_millis(start_date),
                    "endDate": to_millis(end_date),
                    "page": page,
                    "size": page_size,
                }

                payload = await self._request_json(
                    "GET",
                    f"/integration/finance/che/sellers/{self.credential.merchant_id}/settlements",
                    params=query_params,
                )
                content = payload.get("content") or payload.get("items") or []
                if not isinstance(content, list):
                    content = []

                for row in content:
                    order_number = str(
                        row.get("orderNumber")
                        or row.get("packageNumber")
                        or row.get("shipmentPackageId")
                        or row.get("orderId")
                        or ""
                    ).strip() or None
                    amount = parse_float(
                        row.get("debt")
                        or row.get("amount")
                        or row.get("netAmount")
                        or row.get("value")
                        or row.get("commissionAmount")
                        or 0
                    )
                    if str(row.get("transactionType") or settlement_type).lower().find("commissionpositive") >= 0:
                        amount = -abs(amount)
                    if str(row.get("transactionType") or settlement_type).lower().find("commissionnegative") >= 0:
                        amount = abs(amount)

                    records.append(
                        {
                            "transaction_type": str(row.get("transactionType") or settlement_type),
                            "order_number": order_number,
                            "package_number": str(row.get("packageNumber") or row.get("shipmentPackageId") or "").strip() or None,
                            "merchant_sku": str(row.get("merchantSku") or row.get("sku") or "").strip() or None,
                            "commission_amount": abs(amount) if settlement_type.startswith("Commission") else 0.0,
                            "shipping_amount": 0.0,
                            "record_date": parse_datetime(row.get("recordDate") or row.get("transactionDate") or row.get("createdDate")),
                            "raw_payload": row,
                        }
                    )

                page += 1
                if not content or len(content) < page_size:
                    break

            if settlement_type == "CommissionNegative":
                cargo_invoice_serials = await self._fetch_trendyol_cargo_invoice_serials(start_date, end_date)
                if cargo_invoice_serials:
                    records.extend(await self._fetch_trendyol_cargo_invoice_items(cargo_invoice_serials))

        return records

    async def _fetch_trendyol_cargo_invoice_serials(self, start_date: datetime, end_date: datetime) -> list[str]:
        serials: list[str] = []
        page = 0
        page_size = 500
        while True:
            payload = await self._request_json(
                "GET",
                f"/integration/finance/che/sellers/{self.credential.merchant_id}/otherfinancials",
                params={
                    "transactionType": "DeductionInvoices",
                    "startDate": to_millis(start_date),
                    "endDate": to_millis(end_date),
                    "page": page,
                    "size": page_size,
                },
            )
            content = payload.get("content") or payload.get("items") or []
            if not isinstance(content, list):
                break

            for row in content:
                transaction_type = str(row.get("transactionType") or row.get("type") or "").lower()
                description = str(row.get("description") or row.get("transactionSubType") or "").lower()
                if "kargo" in transaction_type or "kargo" in description or "cargo" in description:
                    invoice_serial = str(row.get("id") or row.get("invoiceSerialNumber") or "").strip()
                    if invoice_serial:
                        serials.append(invoice_serial)

            page += 1
            if len(content) < page_size:
                break

        return serials

    async def _fetch_trendyol_cargo_invoice_items(self, invoice_serials: list[str]) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        for invoice_serial in invoice_serials:
            page = 0
            page_size = 200
            while True:
                payload = await self._request_json(
                    "GET",
                    f"/integration/finance/che/sellers/{self.credential.merchant_id}/cargo-invoice/{invoice_serial}/items",
                    params={"page": page, "size": page_size},
                )
                content = payload.get("content") or payload.get("items") or []
                if not isinstance(content, list):
                    break

                for row in content:
                    order_number = str(
                        row.get("orderNumber")
                        or row.get("orderId")
                        or row.get("shipmentPackageId")
                        or row.get("shipmentPackageCode")
                        or ""
                    ).strip() or None
                    shipping_amount = abs(
                        parse_float(
                            row.get("amount")
                            or row.get("fee")
                            or row.get("cargoAmount")
                            or row.get("price")
                            or 0
                        )
                    )
                    records.append(
                        {
                            "transaction_type": "CargoInvoice",
                            "order_number": order_number,
                            "package_number": str(row.get("shipmentPackageId") or row.get("packageNumber") or "").strip() or None,
                            "merchant_sku": str(row.get("merchantSku") or row.get("sku") or "").strip() or None,
                            "commission_amount": 0.0,
                            "shipping_amount": shipping_amount,
                            "record_date": parse_datetime(row.get("recordDate") or row.get("transactionDate")),
                            "raw_payload": row,
                        }
                    )

                page += 1
                if len(content) < page_size:
                    break

        return records

    async def push_prices(self, items: list[PriceUpdateItem]) -> dict[str, Any]:
        accepted_batches = 0
        warnings: list[str] = []

        for batch in chunked(items, self.price_batch_size):
            payload_items: list[dict[str, Any]] = []
            for item in batch:
                sku = item.barcode or item.merchant_sku or item.sku
                if not sku:
                    warnings.append("Trendyol price update skipped because no barcode/merchant_sku was supplied.")
                    continue
                quantity = max(0, item.quantity if item.quantity is not None else 0)
                sale_price = round2(item.sale_price)
                list_price = round2(item.list_price if item.list_price is not None else sale_price)
                payload_items.append(
                    {
                        "barcode": sku,
                        "quantity": quantity,
                        "salePrice": sale_price,
                        "listPrice": max(list_price, sale_price),
                    }
                )

            if not payload_items:
                continue

            await self._request_json(
                "POST",
                f"/integration/products/sellers/{self.credential.merchant_id}/products/price-and-inventory",
                json_body={"items": payload_items},
            )
            accepted_batches += 1

        return {"accepted_batches": accepted_batches, "warnings": warnings}

    async def fetch_catalog_products(self) -> list[dict[str, Any]]:
        records: list[dict[str, Any]] = []
        seen_keys: set[str] = set()

        async def fetch_mode(approved: bool) -> list[dict[str, Any]]:
            page = 0
            size = 100
            mode_records: list[dict[str, Any]] = []

            while True:
                payload = await self._request_json(
                    "GET",
                    f"/integration/product/sellers/{self.credential.merchant_id}/products",
                    params={
                        "approved": str(approved).lower(),
                        "page": page,
                        "size": size,
                    },
                )

                if isinstance(payload, dict):
                    content = payload.get("content") or payload.get("items") or payload.get("data") or payload.get("products") or []
                    total_pages = parse_int(payload.get("totalPages"), 0)
                elif isinstance(payload, list):
                    content = payload
                    total_pages = 0
                else:
                    content = []
                    total_pages = 0

                if not isinstance(content, list):
                    content = []

                for row in content:
                    if not isinstance(row, dict):
                        continue
                    sku = normalize_import_sku(first_non_empty(row.get("sellerBarcode"), row.get("stockCode"), row.get("merchantSku"), row.get("barcode")))
                    barcode = normalize_import_sku(first_non_empty(row.get("barcode"), row.get("sellerBarcode")))
                    normalized = normalize_remote_catalog_record(
                        "trendyol",
                        row,
                        sku=sku,
                        barcode=barcode,
                        fallback_name=str(first_non_empty(row.get("description"), row.get("name"), row.get("title")) or ""),
                    )
                    dedupe_key = normalized["sku"] or normalized["barcode"] or stable_hash({"marketplace": "trendyol", "row": row})
                    if dedupe_key in seen_keys:
                        continue
                    seen_keys.add(dedupe_key)
                    mode_records.append(normalized)

                if not content:
                    break

                if total_pages and page >= total_pages - 1:
                    break

                if len(content) < size:
                    break

                page += 1

            return mode_records

        records.extend(await fetch_mode(True))
        records.extend(await fetch_mode(False))
        return records


class HepsiburadaAdapter(BaseMarketplaceAdapter):
    base_url = os.getenv("HEPSIBURADA_ORDER_BASE_URL", "https://radium.hepsiburada.com").rstrip("/")
    listing_base_url = os.getenv("HEPSIBURADA_LISTING_BASE_URL", "https://listing-external-sit.hepsiburada.com").rstrip("/")
    finance_base_url = os.getenv("HEPSIBURADA_FINANCE_BASE_URL", "https://mpfinance-external-sit.hepsiburada.com").rstrip("/")
    user_agent = os.getenv("HEPSIBURADA_USER_AGENT", "HesapG/1.0")
    price_batch_size = 4000

    async def fetch_orders(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        offset = 0
        limit = 200
        records: list[dict[str, Any]] = []

        while True:
            payload = await self._request_json(
                "GET",
                "/api/order/order_status",
                params={
                    "startDate": start_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "endDate": end_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "page": max(1, offset // limit + 1),
                    "size": limit,
                    "status": "Delivered",
                },
            )
            content = payload.get("content") or payload.get("items") or payload.get("orders") or []
            if not isinstance(content, list):
                content = []

            for order in content:
                order_number = str(order.get("orderNumber") or order.get("merchantOrderNumber") or order.get("id") or "").strip()
                package_number = str(order.get("packageNumber") or order.get("shipmentPackageId") or "").strip() or None
                order_date = (
                    parse_datetime(order.get("orderDate"))
                    or parse_datetime(order.get("lastStatusUpdateDate"))
                    or parse_datetime(order.get("createdDate"))
                    or now_utc()
                )
                buyer_name = str(order.get("customerName") or order.get("buyerName") or "").strip() or None
                order_status = str(order.get("status") or order.get("orderStatus") or "completed")
                currency_code = str(order.get("currencyCode") or order.get("currency") or "TRY")
                line_items = order.get("items") or order.get("lines") or order.get("orderItems") or []
                if not isinstance(line_items, list) or len(line_items) == 0:
                    line_items = [order]

                for index, line in enumerate(line_items):
                    merchant_sku = str(
                        line.get("merchantSku")
                        or line.get("merchantSkuCode")
                        or line.get("sku")
                        or order.get("merchantSku")
                        or ""
                    ).strip() or None
                    barcode = str(line.get("barcode") or line.get("hepsiburadaSku") or merchant_sku or "").strip() or None
                    quantity = max(1.0, parse_float(line.get("quantity") or order.get("quantity") or 1, 1))
                    unit_price = parse_float(
                        (
                            line.get("unitPrice", {}).get("amount")
                            if isinstance(line.get("unitPrice"), dict)
                            else line.get("unitPrice")
                        )
                        or (
                            line.get("price", {}).get("amount")
                            if isinstance(line.get("price"), dict)
                            else line.get("price")
                        )
                        or order.get("totalAmount"),
                        0,
                    )
                    line_total = parse_float(
                        (
                            line.get("totalPrice", {}).get("amount")
                            if isinstance(line.get("totalPrice"), dict)
                            else line.get("totalPrice")
                        )
                        or (
                            line.get("lineTotal", {}).get("amount")
                            if isinstance(line.get("lineTotal"), dict)
                            else line.get("lineTotal")
                        )
                        or (unit_price * quantity),
                        unit_price * quantity,
                    )
                    discount_amount = parse_float(line.get("discountAmount") or order.get("discountAmount") or 0)
                    external_line_item_id = str(line.get("orderLineId") or line.get("id") or f"{order_number}-{index}")

                    records.append(
                        {
                            "external_order_number": order_number,
                            "external_package_number": package_number,
                            "external_line_item_id": external_line_item_id,
                            "merchant_sku": merchant_sku,
                            "barcode": barcode,
                            "quantity": quantity,
                            "unit_price": unit_price,
                            "gross_amount": round2(line_total),
                            "discount_amount": discount_amount,
                            "shipping_amount": 0.0,
                            "commission_amount": 0.0,
                            "buyer_name": buyer_name,
                            "currency_code": currency_code,
                            "order_date": order_date,
                            "status": order_status,
                            "status_detail": str(order.get("statusDescription") or line.get("statusDescription") or "").strip() or None,
                            "raw_payload": {"order": order, "line": line},
                        }
                    )

            offset += len(content)
            if len(content) < limit:
                break

        return records

    async def fetch_settlements(self, start_date: datetime, end_date: datetime) -> list[dict[str, Any]]:
        transaction_types = ("Commission", "CommissionRefund", "DeliveryProcessingFee", "DeliveryProcessingFeeRefund", "Return")
        records: list[dict[str, Any]] = []

        for transaction_type in transaction_types:
            offset = 0
            limit = 200
            while True:
                payload = await self._request_json(
                    "GET",
                    f"/transactions/merchantid/{self.credential.merchant_id}",
                    base_url=self.finance_base_url,
                    params={
                        "RecordDateStart": start_date.strftime("%Y-%m-%d %H:%M:%S"),
                        "RecordDateEnd": end_date.strftime("%Y-%m-%d %H:%M:%S"),
                        "TransactionTypes": transaction_type,
                        "Offset": offset,
                        "Limit": limit,
                    },
                )
                content = payload.get("content") or payload.get("items") or payload.get("transactions") or []
                if not isinstance(content, list):
                    content = []

                for row in content:
                    amount = abs(
                        parse_float(
                            row.get("amount")
                            or row.get("debt")
                            or row.get("credit")
                            or row.get("grossAmount")
                            or 0
                        )
                    )
                    record_type = str(row.get("transactionType") or transaction_type)
                    shipping_amount = amount if "deliveryprocessingfee" in record_type.lower() else 0.0
                    commission_amount = amount if "commission" in record_type.lower() else 0.0
                    if "refund" in record_type.lower() or "return" in record_type.lower():
                        shipping_amount *= -1
                        commission_amount *= -1

                    records.append(
                        {
                            "transaction_type": record_type,
                            "order_number": str(row.get("orderNumber") or row.get("merchantOrderNumber") or "").strip() or None,
                            "package_number": str(row.get("packageNumber") or row.get("shipmentPackageId") or "").strip() or None,
                            "merchant_sku": str(row.get("merchantSku") or row.get("sku") or "").strip() or None,
                            "commission_amount": commission_amount,
                            "shipping_amount": shipping_amount,
                            "record_date": parse_datetime(row.get("recordDate") or row.get("paymentDate") or row.get("createdDate")),
                            "raw_payload": row,
                        }
                    )

                offset += len(content)
                if len(content) < limit:
                    break

        return records

    async def push_prices(self, items: list[PriceUpdateItem]) -> dict[str, Any]:
        accepted_batches = 0
        warnings: list[str] = []

        for batch in chunked(items, self.price_batch_size):
            price_payload: list[dict[str, Any]] = []
            stock_payload: list[dict[str, Any]] = []
            for item in batch:
                sku = item.hepsiburada_sku or item.merchant_sku or item.sku or item.barcode
                if not sku:
                    warnings.append("Hepsiburada price update skipped because no merchant_sku/hepsiburada_sku was supplied.")
                    continue
                sale_price = round2(item.sale_price)
                list_price = round2(item.list_price if item.list_price is not None else sale_price)
                price_payload.append(
                    {
                        "merchantSku": sku,
                        "price": sale_price,
                        "listPrice": max(list_price, sale_price),
                    }
                )
                if item.quantity is not None:
                    stock_payload.append({"merchantSku": sku, "availableStock": max(0, int(item.quantity))})

            if price_payload:
                await self._request_json(
                    "POST",
                    f"/listings/merchantid/{self.credential.merchant_id}/price-uploads",
                    base_url=self.listing_base_url,
                    json_body={"listings": price_payload},
                    extra_headers={"Content-Type": "application/json"},
                )
                accepted_batches += 1

            if stock_payload:
                await self._request_json(
                    "POST",
                    f"/listings/merchantid/{self.credential.merchant_id}/stock-uploads",
                    base_url=self.listing_base_url,
                    json_body={"listings": stock_payload},
                    extra_headers={"Content-Type": "application/json"},
                )

        return {"accepted_batches": accepted_batches, "warnings": warnings}

    async def fetch_catalog_products(self) -> list[dict[str, Any]]:
        page = 0
        limit = 1000
        records: list[dict[str, Any]] = []

        while True:
            payload = await self._request_json(
                "GET",
                f"/product/api/products/all-products-of-merchant/{self.credential.merchant_id}",
                base_url=self.listing_base_url,
                params={
                    "page": page,
                    "size": limit,
                },
                extra_headers={"User-Agent": self.user_agent},
            )

            if isinstance(payload, dict):
                content = payload.get("content") or payload.get("items") or payload.get("products") or payload.get("data") or payload
            elif isinstance(payload, list):
                content = payload
            else:
                content = []
            if not isinstance(content, list):
                content = []

            for row in content:
                if not isinstance(row, dict):
                    continue
                sku = normalize_import_sku(first_non_empty(row.get("merchantSku"), row.get("merchantSKU"), row.get("sku"), row.get("hbSku")), uppercase=True)
                barcode = normalize_import_sku(first_non_empty(row.get("barcode"), row.get("productBarcode"), row.get("ean"), row.get("hbSku")), uppercase=True)
                records.append(
                    normalize_remote_catalog_record(
                        "hepsiburada",
                        row,
                        sku=sku,
                        barcode=barcode,
                        fallback_name=str(first_non_empty(row.get("productName"), row.get("name"), row.get("title")) or ""),
                    )
                )

            page += 1
            if len(content) < limit:
                break

        return records


class MarketplaceIntegrationEngine:
    def __init__(self, session: AsyncSession, auth_user_id: str) -> None:
        self.session = session
        self.auth_user_id = auth_user_id

    async def list_status(self) -> MarketplaceStatusResponse:
        rows = await fetch_all_mappings(
            self.session,
            """
            SELECT
              m.marketplace_id,
              m.name AS marketplace_name,
              m.slug AS marketplace_slug,
              c.merchant_id,
              c.encrypted_api_key,
              c.encrypted_api_secret,
              c.is_active,
              c.last_sync_time,
              c.last_sync_scope,
              c.last_error
            FROM marketplaces m
            LEFT JOIN marketplace_credentials c
              ON c.marketplace_id = m.marketplace_id
             AND c.user_id = :user_id
            WHERE m.slug IN ('trendyol', 'hepsiburada')
            ORDER BY m.marketplace_id ASC
            """,
            {"user_id": self.auth_user_id},
        )

        credentials: list[MarketplaceCredentialRead] = []
        for row in rows:
            api_key_masked = None
            has_credentials = bool(row.get("encrypted_api_key") and row.get("encrypted_api_secret"))
            connection_state: Literal["connected", "disconnected", "degraded"] = "disconnected"
            if has_credentials:
                try:
                    decrypted_api_key = self._decrypt(str(row["encrypted_api_key"]))
                    api_key_masked = mask_value(decrypted_api_key)
                    if bool(row.get("is_active")) and not row.get("last_error"):
                        connection_state = "connected"
                    elif row.get("last_error"):
                        connection_state = "degraded"
                except CredentialDecryptionError:
                    connection_state = "degraded"

            credentials.append(
                MarketplaceCredentialRead(
                    marketplace_id=int(row["marketplace_id"]),
                    marketplace_slug=str(row["marketplace_slug"]),
                    marketplace_name=str(row["marketplace_name"]),
                    merchant_id=str(row["merchant_id"]) if row.get("merchant_id") else None,
                    is_active=bool(row.get("is_active")) if row.get("merchant_id") else False,
                    has_credentials=has_credentials,
                    connection_state=connection_state,
                    api_key_masked=api_key_masked,
                    last_sync_time=parse_datetime(row.get("last_sync_time")),
                    last_sync_scope=row.get("last_sync_scope"),
                    last_error=row.get("last_error"),
                )
            )

        return MarketplaceStatusResponse(success=True, marketplaces=credentials, generated_at=now_utc())

    async def upsert_credentials(self, payload: MarketplaceCredentialUpsertRequest) -> MarketplaceCredentialRead:
        marketplace = await fetch_one_mapping(
            self.session,
            "SELECT marketplace_id, name, slug FROM marketplaces WHERE slug = :slug LIMIT 1",
            {"slug": payload.marketplace_slug},
        )
        if marketplace is None:
            raise MarketplaceIntegrationError(f"Marketplace not found: {payload.marketplace_slug}")

        existing = await fetch_one_mapping(
            self.session,
            "SELECT * FROM marketplace_credentials WHERE marketplace_id = :marketplace_id AND user_id = :user_id LIMIT 1",
            {
                "marketplace_id": int(marketplace["marketplace_id"]),
                "user_id": self.auth_user_id,
            },
        )

        api_key = payload.api_key or None
        api_secret = payload.api_secret or None
        if existing:
            if not api_key:
                api_key = self._decrypt(str(existing["encrypted_api_key"]))
            if not api_secret:
                api_secret = self._decrypt(str(existing["encrypted_api_secret"]))
        if not api_key or not api_secret:
            raise MarketplaceIntegrationError("API key and API secret are required when creating credentials.")

        encrypted_api_key = self._encrypt(api_key)
        encrypted_api_secret = self._encrypt(api_secret)
        now_value = now_utc().isoformat()

        if existing:
            await self.session.execute(
                text(
                    """
                    UPDATE marketplace_credentials
                    SET merchant_id = :merchant_id,
                        encrypted_api_key = :encrypted_api_key,
                        encrypted_api_secret = :encrypted_api_secret,
                        is_active = :is_active,
                        updated_at = :updated_at
                    WHERE marketplace_id = :marketplace_id
                      AND user_id = :user_id
                    """
                ),
                {
                    "merchant_id": payload.merchant_id,
                    "encrypted_api_key": encrypted_api_key,
                    "encrypted_api_secret": encrypted_api_secret,
                    "is_active": 1 if payload.is_active else 0,
                    "updated_at": now_value,
                    "marketplace_id": int(marketplace["marketplace_id"]),
                    "user_id": self.auth_user_id,
                },
            )
        else:
            await self.session.execute(
                text(
                    """
                    INSERT INTO marketplace_credentials (
                      user_id,
                      marketplace_id,
                      merchant_id,
                      encrypted_api_key,
                      encrypted_api_secret,
                      is_active,
                      created_at,
                      updated_at
                    ) VALUES (:user_id, :marketplace_id, :merchant_id, :encrypted_api_key, :encrypted_api_secret, :is_active, :created_at, :updated_at)
                    """
                ),
                {
                    "user_id": self.auth_user_id,
                    "marketplace_id": int(marketplace["marketplace_id"]),
                    "merchant_id": payload.merchant_id,
                    "encrypted_api_key": encrypted_api_key,
                    "encrypted_api_secret": encrypted_api_secret,
                    "is_active": 1 if payload.is_active else 0,
                    "created_at": now_value,
                    "updated_at": now_value,
                },
            )

        await self.session.commit()
        refreshed = await fetch_one_mapping(
            self.session,
            """
            SELECT
              m.marketplace_id,
              m.name AS marketplace_name,
              m.slug AS marketplace_slug,
              c.merchant_id,
              c.encrypted_api_key,
              c.encrypted_api_secret,
              c.is_active,
              c.last_sync_time,
              c.last_sync_scope,
              c.last_error
            FROM marketplaces m
            LEFT JOIN marketplace_credentials c
              ON c.marketplace_id = m.marketplace_id
             AND c.user_id = :user_id
            WHERE m.marketplace_id = :marketplace_id
            LIMIT 1
            """,
            {
                "marketplace_id": int(marketplace["marketplace_id"]),
                "user_id": self.auth_user_id,
            },
        )
        assert refreshed is not None
        return self._map_credential_row(refreshed)

    async def sync_marketplace(self, payload: MarketplaceSyncRequest) -> MarketplaceSyncResponse:
        credential = await self._load_credential(payload.marketplace_slug)
        adapter = self._build_adapter(credential)
        end_date = payload.end_date or now_utc()
        start_date = payload.start_date or end_date - timedelta(days=min(payload.lookback_days, DEFAULT_LOOKBACK_DAYS))

        warnings: list[str] = []
        orders_synced = 0
        order_items_synced = 0
        settlements_synced = 0
        cost_snapshots_updated = 0
        price_updates_sent = 0
        order_allocations: dict[str, list[tuple[int, float]]] = {}

        if payload.scope in {"orders", "full"}:
            try:
                order_result = await self._sync_orders(adapter, credential.marketplace_id, start_date, end_date)
                orders_synced += order_result["orders_synced"]
                order_items_synced += order_result["order_items_synced"]
                order_allocations = order_result["order_allocations"]
                await self.session.commit()
            except Exception as error:
                await self.session.rollback()
                warnings.append(f"Order sync failed: {error}")

        if payload.scope in {"settlements", "full"}:
            try:
                settlement_result = await self._sync_settlements(
                    adapter,
                    credential.marketplace_id,
                    start_date,
                    end_date,
                    order_allocations=order_allocations,
                )
                settlements_synced += settlement_result["settlements_synced"]
                cost_snapshots_updated += settlement_result["cost_snapshots_updated"]
                warnings.extend(settlement_result["warnings"])
                await self.session.commit()
            except Exception as error:
                await self.session.rollback()
                warnings.append(f"Settlement sync failed: {error}")

        if payload.publish_price_updates:
            try:
                price_result = await self._sync_prices(adapter, credential.marketplace_id, payload.price_updates)
                price_updates_sent += price_result["price_updates_sent"]
                warnings.extend(price_result["warnings"])
                await self.session.commit()
            except Exception as error:
                await self.session.rollback()
                warnings.append(f"Price sync failed: {error}")

        sync_scope = payload.scope
        if payload.publish_price_updates:
            sync_scope = f"{sync_scope}+prices"
        await self._touch_sync_metadata(credential.marketplace_id, sync_scope, warnings)
        await self.session.commit()

        return MarketplaceSyncResponse(
            success=True,
            marketplace_slug=payload.marketplace_slug,
            scope=sync_scope,
            orders_synced=orders_synced,
            order_items_synced=order_items_synced,
            settlements_synced=settlements_synced,
            cost_snapshots_updated=cost_snapshots_updated,
            price_updates_sent=price_updates_sent,
            warnings=warnings,
            last_sync_time=now_utc(),
        )

    async def push_prices(self, payload: MarketplacePricePushRequest) -> MarketplacePricePushResponse:
        credential = await self._load_credential(payload.marketplace_slug)
        adapter = self._build_adapter(credential)
        price_result = await self._sync_prices(adapter, credential.marketplace_id, payload.items)
        await self._touch_sync_metadata(credential.marketplace_id, "prices", price_result["warnings"])
        await self.session.commit()
        return MarketplacePricePushResponse(
            success=True,
            marketplace_slug=payload.marketplace_slug,
            price_updates_sent=price_result["price_updates_sent"],
            warnings=price_result["warnings"],
            last_sync_time=now_utc(),
        )

    async def import_catalogs(self, payload: MarketplaceCatalogImportRequest) -> MarketplaceCatalogImportResponse:
        target_slugs = ["trendyol", "hepsiburada"] if payload.marketplace_slug == "all" else [payload.marketplace_slug]
        warnings: list[str] = []
        processed_marketplaces: list[str] = []
        totals = CatalogImportSummary()

        for marketplace_slug in target_slugs:
            try:
                credential = await self._load_credential(marketplace_slug)
            except MarketplaceIntegrationError as error:
                warnings.append(str(error))
                continue

            if not credential.is_active:
                warnings.append(f"{credential.marketplace_name} bağlantısı pasif olduğu için atlandı.")
                continue

            adapter = self._build_adapter(credential)
            try:
                catalog_rows = await adapter.fetch_catalog_products()
                summary = await self._upsert_catalog_products(credential, catalog_rows)
                await self._touch_sync_metadata(credential.marketplace_id, "catalog_import", [])
                await self.session.commit()
            except Exception as error:
                await self.session.rollback()
                warning = f"{credential.marketplace_name} katalog içe aktarımı başarısız: {error}"
                warnings.append(warning)
                try:
                    await self._touch_sync_metadata(credential.marketplace_id, "catalog_import", [warning])
                    await self.session.commit()
                except Exception:
                    await self.session.rollback()
                continue

            processed_marketplaces.append(credential.marketplace_slug)
            totals.created += summary.created
            totals.updated += summary.updated
            totals.unchanged += summary.unchanged
            totals.settings_upserted += summary.settings_upserted
            totals.inventory_rows_upserted += summary.inventory_rows_upserted
            totals.processed += summary.processed

        if not processed_marketplaces:
            raise MarketplaceIntegrationError("No active marketplace credentials were found for catalog import.")

        return MarketplaceCatalogImportResponse(
            success=True,
            marketplace_slug=payload.marketplace_slug,
            marketplaces_processed=processed_marketplaces,
            products_created=totals.created,
            products_updated=totals.updated,
            products_unchanged=totals.unchanged,
            settings_upserted=totals.settings_upserted,
            inventory_rows_upserted=totals.inventory_rows_upserted,
            warnings=warnings,
            last_sync_time=now_utc(),
        )

    async def _load_credential(self, marketplace_slug: str) -> MarketplaceCredentialContext:
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT
              m.marketplace_id,
              m.name AS marketplace_name,
              m.slug AS marketplace_slug,
              c.merchant_id,
              c.encrypted_api_key,
              c.encrypted_api_secret,
              c.is_active,
              c.last_sync_time,
              c.last_sync_scope,
              c.last_error
            FROM marketplaces m
            LEFT JOIN marketplace_credentials c
              ON c.marketplace_id = m.marketplace_id
             AND c.user_id = :user_id
            WHERE m.slug = :slug
            LIMIT 1
            """,
            {
                "slug": marketplace_slug,
                "user_id": self.auth_user_id,
            },
        )
        if row is None:
            raise MarketplaceIntegrationError(f"Marketplace not found: {marketplace_slug}")
        if not row.get("merchant_id") or not row.get("encrypted_api_key") or not row.get("encrypted_api_secret"):
            raise MarketplaceIntegrationError(f"Missing credentials for marketplace: {marketplace_slug}")

        try:
            api_key = self._decrypt(str(row["encrypted_api_key"]))
            api_secret = self._decrypt(str(row["encrypted_api_secret"]))
        except CredentialDecryptionError as error:
            raise MarketplaceIntegrationError(f"{marketplace_slug} için kimlik bilgileri çözümlenemedi.") from error

        return MarketplaceCredentialContext(
            marketplace_id=int(row["marketplace_id"]),
            marketplace_slug=str(row["marketplace_slug"]),
            marketplace_name=str(row["marketplace_name"]),
            merchant_id=str(row["merchant_id"]),
            api_key=api_key,
            api_secret=api_secret,
            is_active=bool(row.get("is_active")),
            last_sync_time=parse_datetime(row.get("last_sync_time")),
            last_sync_scope=row.get("last_sync_scope"),
            last_error=row.get("last_error"),
        )

    async def _upsert_catalog_products(
        self,
        credential: MarketplaceCredentialContext,
        rows: list[dict[str, Any]],
    ) -> CatalogImportSummary:
        summary = CatalogImportSummary()
        if not rows:
            return summary

        for row in rows:
            summary.processed += 1
            item = row
            sku = normalize_import_sku(item.get("sku"))
            barcode = normalize_import_sku(item.get("barcode"))
            existing = await self._find_product_for_catalog_import(sku, barcode)
            if existing is None:
                product_id = await self._insert_catalog_product(item, credential)
                summary.created += 1
            else:
                product_id = int(existing["product_id"])
                changed = await self._update_catalog_product(product_id, item, credential, existing)
                summary.updated += 1 if changed else 0
                summary.unchanged += 0 if changed else 1

            settings_changed = await self._upsert_catalog_setting(product_id, credential, item)
            inventory_changed = await self._upsert_catalog_inventory(product_id, credential, item)
            summary.settings_upserted += settings_changed
            summary.inventory_rows_upserted += inventory_changed

        return summary

    async def _find_product_for_catalog_import(self, sku: str | None, barcode: str | None) -> dict[str, Any] | None:
        candidates = [candidate for candidate in (sku, barcode) if candidate]
        for candidate in candidates:
            row = await fetch_one_mapping(
                self.session,
                """
                SELECT product_id, name, sku, barcode, image_url, category_id, profile_id, category_path, cost, packaging_cost, desi, status
                FROM products
                WHERE LOWER(TRIM(COALESCE(sku, ''))) = LOWER(TRIM(:value))
                   OR LOWER(TRIM(COALESCE(barcode, ''))) = LOWER(TRIM(:value))
                LIMIT 1
                """,
                {"value": candidate},
            )
            if row is not None:
                return row
        return None

    async def _insert_catalog_product(self, item: dict[str, Any], credential: MarketplaceCredentialContext) -> int:
        params = {
            "name": str(item.get("name") or "İsimsiz Ürün").strip(),
            "sku": item.get("sku"),
            "barcode": item.get("barcode"),
            "image_url": item.get("image_url"),
            "category_id": item.get("category_id"),
            "category_path": item.get("category_path"),
            "profile_id": 1,
            "cost": round2(item.get("buying_price") or 0),
            "packaging_cost": 0.0,
            "desi": round2(item.get("desi") or 0),
            "status": item.get("status") or "active",
        }
        await self.session.execute(
            text(
                """
                INSERT INTO products (
                  name,
                  sku,
                  barcode,
                  image_url,
                  category_id,
                  category_path,
                  profile_id,
                  cost,
                  packaging_cost,
                  desi,
                  status
                ) VALUES (
                  :name,
                  :sku,
                  :barcode,
                  :image_url,
                  :category_id,
                  :category_path,
                  :profile_id,
                  :cost,
                  :packaging_cost,
                  :desi,
                  :status
                )
                """
            ),
            params,
        )

        row = await fetch_one_mapping(self.session, "SELECT last_insert_rowid() AS product_id")
        if row is None:
            raise MarketplaceIntegrationError("Katalog içe aktarma sırasında eklenen ürün kimliği çözümlenemedi.")

        product_id = int(row["product_id"])
        # Keep the imported marketplace linked to the newly created product.
        return product_id

    async def _update_catalog_product(
        self,
        product_id: int,
        item: dict[str, Any],
        credential: MarketplaceCredentialContext,
        existing: dict[str, Any],
    ) -> bool:
        next_name = str(item.get("name") or existing.get("name") or "İsimsiz Ürün").strip()
        next_image_url = item.get("image_url") or existing.get("image_url")
        next_category_id = item.get("category_id") if item.get("category_id") is not None else existing.get("category_id")
        next_category_path = item.get("category_path") or existing.get("category_path") or "Katalog"
        next_cost = round2(existing.get("cost") or 0)
        incoming_cost = round2(item.get("buying_price") or 0)
        if next_cost <= 0 and incoming_cost > 0:
            next_cost = incoming_cost
        next_packaging_cost = round2(existing.get("packaging_cost") or 0)
        next_desi = round2(item.get("desi") or existing.get("desi") or 0)
        next_status = str(item.get("status") or existing.get("status") or "active")
        next_sku = existing.get("sku") or item.get("sku")
        next_barcode = existing.get("barcode") or item.get("barcode")

        result = await self.session.execute(
            text(
                """
                UPDATE products
                SET name = :name,
                    sku = :sku,
                    barcode = :barcode,
                    image_url = :image_url,
                    category_id = :category_id,
                    category_path = :category_path,
                    profile_id = :profile_id,
                    cost = :cost,
                    packaging_cost = :packaging_cost,
                    desi = :desi,
                    status = :status
                WHERE product_id = :product_id
                """
            ),
            {
                "name": next_name,
                "sku": next_sku,
                "barcode": next_barcode,
                "image_url": next_image_url,
                "category_id": next_category_id,
                "category_path": next_category_path,
                "profile_id": int(existing.get("profile_id") or 1),
                "cost": next_cost,
                "packaging_cost": next_packaging_cost,
                "desi": next_desi,
                "status": next_status,
                "product_id": product_id,
            },
        )
        return bool(result.rowcount and result.rowcount > 0)

    async def _upsert_catalog_setting(self, product_id: int, credential: MarketplaceCredentialContext, item: dict[str, Any]) -> int:
        marketplace_id = credential.marketplace_id
        default_shipping_company_id = await self._get_marketplace_shipping_company_id(marketplace_id)
        sale_price = round2(item.get("sale_price") or 0)

        await self.session.execute(
            text("DELETE FROM product_marketplace_settings WHERE product_id = :product_id AND marketplace_id = :marketplace_id"),
            {"product_id": product_id, "marketplace_id": marketplace_id},
        )
        await self.session.execute(
            text(
                """
                INSERT INTO product_marketplace_settings (
                  product_id,
                  marketplace_id,
                  shipping_company_id,
                  sale_price,
                  manual_shipping_cost,
                  payment_gateway_rule_id,
                  shipping_mode
                ) VALUES (
                  :product_id,
                  :marketplace_id,
                  :shipping_company_id,
                  :sale_price,
                  :manual_shipping_cost,
                  :payment_gateway_rule_id,
                  :shipping_mode
                )
                """
            ),
            {
                "product_id": product_id,
                "marketplace_id": marketplace_id,
                "shipping_company_id": default_shipping_company_id,
                "sale_price": sale_price,
                "manual_shipping_cost": None,
                "payment_gateway_rule_id": None,
                "shipping_mode": "marketplace_rate",
            },
        )
        return 1

    async def _upsert_catalog_inventory(self, product_id: int, credential: MarketplaceCredentialContext, item: dict[str, Any]) -> int:
        stock = round2(item.get("stock") or 0)
        today = now_utc().date().isoformat()
        await self.session.execute(
            text(
                """
                DELETE FROM inventory_daily
                WHERE product_id = :product_id
                  AND marketplace_id = :marketplace_id
                  AND inventory_date = :inventory_date
                """
            ),
            {
                "product_id": product_id,
                "marketplace_id": credential.marketplace_id,
                "inventory_date": today,
            },
        )
        await self.session.execute(
            text(
                """
                INSERT INTO inventory_daily (
                  product_id,
                  marketplace_id,
                  inventory_date,
                  stock_qty,
                  reserved_qty
                ) VALUES (
                  :product_id,
                  :marketplace_id,
                  :inventory_date,
                  :stock_qty,
                  :reserved_qty
                )
                """
            ),
            {
                "product_id": product_id,
                "marketplace_id": credential.marketplace_id,
                "inventory_date": today,
                "stock_qty": stock,
                "reserved_qty": 0,
            },
        )
        return 1

    async def _get_marketplace_shipping_company_id(self, marketplace_id: int) -> int | None:
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT shipping_company_id
            FROM marketplace_shipping_options
            WHERE marketplace_id = :marketplace_id
            ORDER BY shipping_company_id ASC
            LIMIT 1
            """,
            {"marketplace_id": marketplace_id},
        )
        if row is None:
            return None
        return int(row["shipping_company_id"])

    def _build_adapter(self, credential: MarketplaceCredentialContext) -> BaseMarketplaceAdapter:
        slug = normalize_slug(credential.marketplace_slug)
        if slug == "trendyol":
            return TrendyolAdapter(credential)
        if slug == "hepsiburada":
            return HepsiburadaAdapter(credential)
        raise MarketplaceIntegrationError(f"Unsupported marketplace: {credential.marketplace_slug}")

    async def _sync_orders(
        self,
        adapter: BaseMarketplaceAdapter,
        marketplace_id: int,
        start_date: datetime,
        end_date: datetime,
    ) -> dict[str, Any]:
        orders = await adapter.fetch_orders(start_date, end_date)
        orders_synced = 0
        order_items_synced = 0
        order_allocations: dict[str, list[tuple[int, float]]] = defaultdict(list)

        for record in orders:
            product_id = await self._resolve_product_id(record)
            if product_id is None:
                continue

            order_id = await self._upsert_order_row(
                marketplace_id=marketplace_id,
                product_id=product_id,
                record=record,
            )
            await self._upsert_order_item_row(
                order_id=order_id,
                marketplace_order_number=str(record["external_order_number"]),
                record=record,
                product_id=product_id,
            )

            order_number = str(record["external_order_number"])
            order_allocations[order_number].append((product_id, round2(record.get("gross_amount") or record.get("unit_price") or 0)))
            orders_synced += 1
            order_items_synced += 1

        return {
            "orders_synced": orders_synced,
            "order_items_synced": order_items_synced,
            "order_allocations": dict(order_allocations),
        }

    async def _sync_settlements(
        self,
        adapter: BaseMarketplaceAdapter,
        marketplace_id: int,
        start_date: datetime,
        end_date: datetime,
        *,
        order_allocations: dict[str, list[tuple[int, float]]],
    ) -> dict[str, Any]:
        settlements = await adapter.fetch_settlements(start_date, end_date)
        settlement_group_totals: dict[int, dict[str, float]] = defaultdict(lambda: {"commission": 0.0, "shipping": 0.0})
        warnings: list[str] = []

        for record in settlements:
            order_number = str(record.get("order_number") or "").strip()
            commission_amount = round2(record.get("commission_amount") or 0)
            shipping_amount = round2(record.get("shipping_amount") or 0)
            allocations = order_allocations.get(order_number, [])

            if allocations:
                total_value = sum(max(0.0, amount) for _, amount in allocations)
                if total_value <= 0:
                    total_value = float(len(allocations))

                for product_id, amount in allocations:
                    share = (amount / total_value) if total_value > 0 else 0
                    settlement_group_totals[product_id]["commission"] += commission_amount * share
                    settlement_group_totals[product_id]["shipping"] += shipping_amount * share
            else:
                product_id = await self._resolve_product_id(record)
                if product_id is None:
                    warnings.append(f"Settlement skipped because product mapping was not found for order {order_number or 'unknown'}.")
                    continue
                settlement_group_totals[product_id]["commission"] += commission_amount
                settlement_group_totals[product_id]["shipping"] += shipping_amount

        cost_snapshots_updated = 0
        for product_id, totals in settlement_group_totals.items():
            updated = await self._update_cost_snapshot(
                product_id=product_id,
                marketplace_id=marketplace_id,
                realized_commission=totals["commission"],
                realized_shipping_cost=totals["shipping"],
            )
            cost_snapshots_updated += updated

        return {
            "settlements_synced": len(settlements),
            "cost_snapshots_updated": cost_snapshots_updated,
            "warnings": warnings,
        }

    async def _sync_prices(
        self,
        adapter: BaseMarketplaceAdapter,
        marketplace_id: int,
        explicit_items: list[PriceUpdateItem] | None,
    ) -> dict[str, Any]:
        items = explicit_items if explicit_items is not None else await self._build_autopublish_items(marketplace_id)
        if not items:
            return {"price_updates_sent": 0, "warnings": ["No price updates were generated from optimization runs."]}

        result = await adapter.push_prices(items)
        warnings = list(result.get("warnings") or [])
        sent = int(result.get("accepted_batches") or 0)
        await self._persist_price_targets(marketplace_id, items)
        return {"price_updates_sent": sent, "warnings": warnings}

    async def _build_autopublish_items(self, marketplace_id: int) -> list[PriceUpdateItem]:
        rows = await fetch_all_mappings(
            self.session,
            """
            SELECT
              r.product_id,
              r.marketplace_id,
              r.recommended_price,
              r.current_price,
              r.created_at,
              p.sku,
              p.barcode,
              p.name
            FROM price_optimization_runs r
            LEFT JOIN products p ON p.product_id = r.product_id
            WHERE r.marketplace_id = :marketplace_id
              AND UPPER(COALESCE(r.status, 'DRAFT')) = 'PUBLISHED'
            ORDER BY COALESCE(r.published_at, r.created_at) DESC, r.run_id DESC
            """,
            {"marketplace_id": marketplace_id},
        )
        if not rows:
            return []

        seen_products: set[int] = set()
        items: list[PriceUpdateItem] = []
        for row in rows:
            product_id = int(row["product_id"])
            if product_id in seen_products:
                continue
            seen_products.add(product_id)

            recommended_price = round2(row.get("recommended_price") or 0)
            current_sale_price = await self._resolve_current_sale_price(product_id, marketplace_id)
            if recommended_price <= 0:
                continue
            if abs(recommended_price - current_sale_price) < 0.01:
                continue

            sku = str(row.get("sku") or "").strip() or None
            barcode = str(row.get("barcode") or "").strip() or None
            quantity = await self._resolve_current_stock(product_id, marketplace_id)
            items.append(
                PriceUpdateItem(
                    product_id=product_id,
                    marketplace_id=marketplace_id,
                    sku=sku,
                    merchant_sku=sku or barcode,
                    barcode=barcode or sku,
                    hepsiburada_sku=barcode or sku,
                    quantity=int(quantity),
                    sale_price=recommended_price,
                    list_price=recommended_price,
                )
            )

        return items

    async def _persist_price_targets(self, marketplace_id: int, items: list[PriceUpdateItem]) -> None:
        for item in items:
            if item.product_id is None:
                continue
            await self.session.execute(
                text(
                    """
                    UPDATE product_marketplace_settings
                    SET sale_price = :sale_price
                    WHERE product_id = :product_id AND marketplace_id = :marketplace_id
                    """
                ),
                {
                    "sale_price": round2(item.sale_price),
                    "product_id": int(item.product_id),
                    "marketplace_id": marketplace_id,
                },
            )

    async def _resolve_current_sale_price(self, product_id: int, marketplace_id: int) -> float:
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT sale_price
            FROM product_marketplace_settings
            WHERE product_id = :product_id AND marketplace_id = :marketplace_id
            LIMIT 1
            """,
            {"product_id": product_id, "marketplace_id": marketplace_id},
        )
        if row and row.get("sale_price") is not None:
            return round2(row["sale_price"])
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT list_price
            FROM cost_results
            WHERE product_id = :product_id AND marketplace_id = :marketplace_id
            ORDER BY calculated_at DESC, id DESC
            LIMIT 1
            """,
            {"product_id": product_id, "marketplace_id": marketplace_id},
        )
        return round2(row["list_price"]) if row and row.get("list_price") is not None else 0.0

    async def _resolve_current_stock(self, product_id: int, marketplace_id: int) -> float:
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT stock_qty
            FROM inventory_daily
            WHERE product_id = :product_id AND marketplace_id = :marketplace_id
            ORDER BY inventory_date DESC, inventory_id DESC
            LIMIT 1
            """,
            {"product_id": product_id, "marketplace_id": marketplace_id},
        )
        return round2(row["stock_qty"]) if row and row.get("stock_qty") is not None else 0.0

    async def _resolve_product_id(self, record: dict[str, Any]) -> int | None:
        explicit_product_id = record.get("product_id")
        if explicit_product_id is not None:
            return int(explicit_product_id)

        candidates = [
            record.get("merchant_sku"),
            record.get("barcode"),
            record.get("sku"),
            record.get("hepsiburada_sku"),
        ]
        for candidate in candidates:
            if not candidate:
                continue
            row = await fetch_one_mapping(
                self.session,
                """
                SELECT product_id
                FROM products
                WHERE LOWER(TRIM(COALESCE(sku, ''))) = LOWER(TRIM(:value))
                   OR LOWER(TRIM(COALESCE(barcode, ''))) = LOWER(TRIM(:value))
                LIMIT 1
                """,
                {"value": str(candidate)},
            )
            if row is not None:
                return int(row["product_id"])
        return None

    async def _upsert_order_row(self, *, marketplace_id: int, product_id: int, record: dict[str, Any]) -> int:
        payload_json = json.dumps(record.get("raw_payload") or {}, ensure_ascii=False)
        params = {
            "product_id": product_id,
            "marketplace_id": marketplace_id,
            "order_date": to_iso_day(record["order_date"]),
            "quantity": round2(record.get("quantity") or 1),
            "unit_price": round2(record.get("unit_price") or 0),
            "status": str(record.get("status") or "completed"),
            "external_order_number": record.get("external_order_number"),
            "external_package_number": record.get("external_package_number"),
            "external_line_item_id": record.get("external_line_item_id"),
            "merchant_sku": record.get("merchant_sku"),
            "barcode": record.get("barcode"),
            "buyer_name": record.get("buyer_name"),
            "order_status_detail": record.get("status_detail"),
            "currency_code": record.get("currency_code") or "TRY",
            "gross_amount": round2(record.get("gross_amount") or 0),
            "discount_amount": round2(record.get("discount_amount") or 0),
            "shipping_amount": round2(record.get("shipping_amount") or 0),
            "commission_amount": round2(record.get("commission_amount") or 0),
            "realized_commission": 0,
            "realized_shipping_cost": 0,
            "settlement_transaction_type": None,
            "raw_payload_json": payload_json,
            "last_synced_at": now_utc().isoformat(),
            "updated_at": now_utc().isoformat(),
        }

        await self.session.execute(
            text(
                """
                INSERT INTO orders (
                  product_id,
                  marketplace_id,
                  order_date,
                  quantity,
                  unit_price,
                  status,
                  external_order_number,
                  external_package_number,
                  external_line_item_id,
                  merchant_sku,
                  barcode,
                  buyer_name,
                  order_status_detail,
                  currency_code,
                  gross_amount,
                  discount_amount,
                  shipping_amount,
                  commission_amount,
                  realized_commission,
                  realized_shipping_cost,
                  settlement_transaction_type,
                  raw_payload_json,
                  last_synced_at,
                  updated_at
                ) VALUES (
                  :product_id,
                  :marketplace_id,
                  :order_date,
                  :quantity,
                  :unit_price,
                  :status,
                  :external_order_number,
                  :external_package_number,
                  :external_line_item_id,
                  :merchant_sku,
                  :barcode,
                  :buyer_name,
                  :order_status_detail,
                  :currency_code,
                  :gross_amount,
                  :discount_amount,
                  :shipping_amount,
                  :commission_amount,
                  :realized_commission,
                  :realized_shipping_cost,
                  :settlement_transaction_type,
                  :raw_payload_json,
                  :last_synced_at,
                  :updated_at
                )
                ON CONFLICT(marketplace_id, external_order_number, external_line_item_id)
                DO UPDATE SET
                  product_id = excluded.product_id,
                  order_date = excluded.order_date,
                  quantity = excluded.quantity,
                  unit_price = excluded.unit_price,
                  status = excluded.status,
                  external_package_number = excluded.external_package_number,
                  merchant_sku = excluded.merchant_sku,
                  barcode = excluded.barcode,
                  buyer_name = excluded.buyer_name,
                  order_status_detail = excluded.order_status_detail,
                  currency_code = excluded.currency_code,
                  gross_amount = excluded.gross_amount,
                  discount_amount = excluded.discount_amount,
                  shipping_amount = excluded.shipping_amount,
                  commission_amount = excluded.commission_amount,
                  raw_payload_json = excluded.raw_payload_json,
                  last_synced_at = excluded.last_synced_at,
                  updated_at = excluded.updated_at
                """
            ),
            params,
        )

        row = await fetch_one_mapping(
            self.session,
            """
            SELECT order_id
            FROM orders
            WHERE marketplace_id = :marketplace_id
              AND external_order_number = :external_order_number
              AND external_line_item_id = :external_line_item_id
            LIMIT 1
            """,
            {
                "marketplace_id": marketplace_id,
                "external_order_number": record.get("external_order_number"),
                "external_line_item_id": record.get("external_line_item_id"),
            },
        )
        if row is None:
            raise MarketplaceIntegrationError("Upsert sonrasında sipariş kimliği çözümlenemedi.")
        return int(row["order_id"])

    async def _upsert_order_item_row(
        self,
        *,
        order_id: int,
        marketplace_order_number: str,
        record: dict[str, Any],
        product_id: int | None,
    ) -> None:
        params = {
            "order_id": order_id,
            "marketplace_order_number": marketplace_order_number,
            "package_number": record.get("external_package_number"),
            "external_order_line_id": record.get("external_line_item_id"),
            "merchant_sku": record.get("merchant_sku"),
            "barcode": record.get("barcode"),
            "product_id": product_id,
            "quantity": round2(record.get("quantity") or 1),
            "unit_price": round2(record.get("unit_price") or 0),
            "line_total": round2(record.get("gross_amount") or 0),
            "commission_amount": round2(record.get("commission_amount") or 0),
            "shipping_cost": round2(record.get("shipping_amount") or 0),
            "transaction_type": record.get("status"),
            "raw_payload_json": json.dumps(record.get("raw_payload") or {}, ensure_ascii=False),
            "updated_at": now_utc().isoformat(),
        }

        await self.session.execute(
            text(
                """
                INSERT INTO order_items (
                  order_id,
                  marketplace_order_number,
                  package_number,
                  external_order_line_id,
                  merchant_sku,
                  barcode,
                  product_id,
                  quantity,
                  unit_price,
                  line_total,
                  commission_amount,
                  shipping_cost,
                  transaction_type,
                  raw_payload_json,
                  updated_at
                ) VALUES (
                  :order_id,
                  :marketplace_order_number,
                  :package_number,
                  :external_order_line_id,
                  :merchant_sku,
                  :barcode,
                  :product_id,
                  :quantity,
                  :unit_price,
                  :line_total,
                  :commission_amount,
                  :shipping_cost,
                  :transaction_type,
                  :raw_payload_json,
                  :updated_at
                )
                ON CONFLICT(marketplace_order_number, external_order_line_id)
                DO UPDATE SET
                  order_id = excluded.order_id,
                  package_number = excluded.package_number,
                  merchant_sku = excluded.merchant_sku,
                  barcode = excluded.barcode,
                  product_id = excluded.product_id,
                  quantity = excluded.quantity,
                  unit_price = excluded.unit_price,
                  line_total = excluded.line_total,
                  commission_amount = excluded.commission_amount,
                  shipping_cost = excluded.shipping_cost,
                  transaction_type = excluded.transaction_type,
                  raw_payload_json = excluded.raw_payload_json,
                  updated_at = excluded.updated_at
                """
            ),
            params,
        )

    async def _update_cost_snapshot(
        self,
        *,
        product_id: int,
        marketplace_id: int,
        realized_commission: float,
        realized_shipping_cost: float,
    ) -> int:
        row = await fetch_one_mapping(
            self.session,
            """
            SELECT id
            FROM cost_results
            WHERE product_id = :product_id AND marketplace_id = :marketplace_id
            ORDER BY calculated_at DESC, id DESC
            LIMIT 1
            """,
            {"product_id": product_id, "marketplace_id": marketplace_id},
        )
        if row is None:
            return 0

        await self.session.execute(
            text(
                """
                UPDATE cost_results
                SET realized_commission = :realized_commission,
                    realized_shipping_cost = :realized_shipping_cost
                WHERE id = :id
                """
            ),
            {
                "id": int(row["id"]),
                "realized_commission": round2(realized_commission),
                "realized_shipping_cost": round2(realized_shipping_cost),
            },
        )
        return 1

    async def _touch_sync_metadata(self, marketplace_id: int, scope: str, warnings: list[str]) -> None:
        await self.session.execute(
            text(
                """
                UPDATE marketplace_credentials
                SET last_sync_time = :last_sync_time,
                    last_sync_scope = :last_sync_scope,
                    last_error = :last_error,
                    updated_at = :updated_at
                WHERE marketplace_id = :marketplace_id
                  AND user_id = :user_id
                """
            ),
            {
                "marketplace_id": marketplace_id,
                "user_id": self.auth_user_id,
                "last_sync_time": now_utc().isoformat(),
                "last_sync_scope": scope,
                "last_error": " | ".join(warnings) if warnings else None,
                "updated_at": now_utc().isoformat(),
            },
        )

    def _map_credential_row(self, row: dict[str, Any]) -> MarketplaceCredentialRead:
        has_credentials = bool(row.get("merchant_id") and row.get("encrypted_api_key") and row.get("encrypted_api_secret"))
        connection_state: Literal["connected", "disconnected", "degraded"] = "disconnected"
        api_key_masked: str | None = None
        if has_credentials:
            try:
                api_key_masked = mask_value(self._decrypt(str(row["encrypted_api_key"])))
                connection_state = "connected" if bool(row.get("is_active")) and not row.get("last_error") else "degraded"
            except CredentialDecryptionError:
                connection_state = "degraded"

        return MarketplaceCredentialRead(
            marketplace_id=int(row["marketplace_id"]),
            marketplace_slug=str(row["marketplace_slug"]),
            marketplace_name=str(row["marketplace_name"]),
            merchant_id=str(row["merchant_id"]) if row.get("merchant_id") else None,
            is_active=bool(row.get("is_active")) if row.get("merchant_id") else False,
            has_credentials=has_credentials,
            connection_state=connection_state,
            api_key_masked=api_key_masked,
            last_sync_time=parse_datetime(row.get("last_sync_time")),
            last_sync_scope=row.get("last_sync_scope"),
            last_error=row.get("last_error"),
        )

    def _encrypt(self, value: str) -> str:
        return get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")

    def _decrypt(self, value: str) -> str:
        try:
            return get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
        except (InvalidToken, ValueError, TypeError) as error:
            raise CredentialDecryptionError("Credential decryption failed.") from error
