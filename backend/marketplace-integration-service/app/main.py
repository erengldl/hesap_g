from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from .dependencies import require_trusted_service
from .database import SessionLocal, get_session, lifespan_context
from .schemas import (
    MarketplaceCatalogImportRequest,
    MarketplaceCatalogImportResponse,
    MarketplaceCredentialUpsertRequest,
    MarketplacePricePushRequest,
    MarketplacePricePushResponse,
    MarketplaceSyncQueuedResponse,
    MarketplaceStatusResponse,
    MarketplaceSyncRequest,
    MarketplaceSyncResponse,
    ProductImageUploadResponse,
)
from .services.marketplace_integration_engine import MarketplaceIntegrationEngine, MarketplaceIntegrationError

LOGGER = logging.getLogger(__name__)
UPLOAD_ROOT = Path(__file__).resolve().parents[4] / "public" / "uploads" / "products"
MAX_IMAGE_SIZE = 5 * 1024 * 1024
ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

app = FastAPI(title="Hesap G Marketplace Integration Service", version="0.1.0", lifespan=lifespan_context)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


def _resolve_upload_extension(file: UploadFile) -> str:
    mime_type = (file.content_type or "").lower().strip()
    if mime_type in ALLOWED_IMAGE_MIME_TYPES:
        return ALLOWED_IMAGE_MIME_TYPES[mime_type]

    suffix = Path(file.filename or "").suffix.lower()
    if suffix == ".jpeg":
        return ".jpg"
    if suffix in {".jpg", ".png", ".webp", ".gif"}:
        return suffix
    raise MarketplaceIntegrationError("Only JPG, PNG, WebP or GIF images can be uploaded.")


async def _save_product_image(file: UploadFile) -> ProductImageUploadResponse:
    if not file.filename:
        raise MarketplaceIntegrationError("Upload file name is missing.")

    payload = await file.read()
    if not payload:
        raise MarketplaceIntegrationError("Empty files cannot be uploaded.")
    if len(payload) > MAX_IMAGE_SIZE:
        raise MarketplaceIntegrationError("Image size must be 5 MB or less.")

    extension = _resolve_upload_extension(file)
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    file_name = f"{datetime.now(tz=timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid4().hex}{extension}"
    destination = UPLOAD_ROOT / file_name
    destination.write_bytes(payload)

    return ProductImageUploadResponse(success=True, url=f"/uploads/products/{file_name}", fileName=file_name)


async def _run_marketplace_sync_background(payload: MarketplaceSyncRequest) -> None:
    async with SessionLocal() as session:
        engine = MarketplaceIntegrationEngine(session)
        try:
            result = await engine.sync_marketplace(payload)
            LOGGER.info(
                "Marketplace sync completed in background",
                extra={
                    "marketplace_slug": payload.marketplace_slug,
                    "scope": result.scope,
                    "orders_synced": result.orders_synced,
                    "order_items_synced": result.order_items_synced,
                },
            )
        except Exception:
            LOGGER.exception("Marketplace sync failed in background", extra={"marketplace_slug": payload.marketplace_slug})


@app.post("/api/v1/products/upload-image", response_model=ProductImageUploadResponse)
async def upload_product_image(
    file: UploadFile = File(...),
    _: None = Depends(require_trusted_service),
) -> ProductImageUploadResponse:
    try:
        return await _save_product_image(file)
    except MarketplaceIntegrationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/v1/integrations/sync/background", response_model=MarketplaceSyncQueuedResponse, status_code=202)
async def integrations_sync_background(
    payload: MarketplaceSyncRequest,
    background_tasks: BackgroundTasks,
    _: None = Depends(require_trusted_service),
) -> MarketplaceSyncQueuedResponse:
    background_tasks.add_task(_run_marketplace_sync_background, payload)
    return MarketplaceSyncQueuedResponse(
        success=True,
        queued=True,
        marketplace_slug=payload.marketplace_slug,
        scope=payload.scope,
        message="Marketplace sync queued for background execution.",
        scheduled_at=datetime.now(tz=timezone.utc),
    )


@app.get("/api/v1/integrations/status", response_model=MarketplaceStatusResponse)
async def integrations_status(
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_trusted_service),
) -> MarketplaceStatusResponse:
    engine = MarketplaceIntegrationEngine(session)
    return await engine.list_status()


@app.put("/api/v1/integrations/credentials", response_model=MarketplaceStatusResponse)
async def integrations_credentials(
    payload: MarketplaceCredentialUpsertRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_trusted_service),
) -> MarketplaceStatusResponse:
    engine = MarketplaceIntegrationEngine(session)
    try:
        await engine.upsert_credentials(payload)
        return await engine.list_status()
    except MarketplaceIntegrationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/v1/integrations/sync", response_model=MarketplaceSyncResponse)
async def integrations_sync(
    payload: MarketplaceSyncRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_trusted_service),
) -> MarketplaceSyncResponse:
    engine = MarketplaceIntegrationEngine(session)
    try:
        return await engine.sync_marketplace(payload)
    except MarketplaceIntegrationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/v1/integrations/prices", response_model=MarketplacePricePushResponse)
async def integrations_prices(
    payload: MarketplacePricePushRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_trusted_service),
) -> MarketplacePricePushResponse:
    engine = MarketplaceIntegrationEngine(session)
    try:
        return await engine.push_prices(payload)
    except MarketplaceIntegrationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/v1/integrations/catalogs/import", response_model=MarketplaceCatalogImportResponse)
async def integrations_catalogs_import(
    payload: MarketplaceCatalogImportRequest,
    session: AsyncSession = Depends(get_session),
    _: None = Depends(require_trusted_service),
) -> MarketplaceCatalogImportResponse:
    engine = MarketplaceIntegrationEngine(session)
    try:
        return await engine.import_catalogs(payload)
    except MarketplaceIntegrationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
