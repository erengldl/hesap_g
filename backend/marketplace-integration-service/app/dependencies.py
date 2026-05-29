from __future__ import annotations

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_trusted_service(
    x_marketplace_service_token: str | None = Header(default=None),
) -> None:
    settings = get_settings()
    if not settings.service_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Marketplace integration service token is not configured.",
        )

    if x_marketplace_service_token != settings.service_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geçersiz pazaryeri servis belirteci.",
        )
