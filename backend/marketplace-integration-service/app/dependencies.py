from __future__ import annotations

from uuid import UUID

from fastapi import Header, HTTPException, status

from .config import get_settings


async def require_trusted_service(
    x_marketplace_service_token: str | None = Header(default=None),
    x_app_auth_user_id: str | None = Header(default=None, alias="x-app-auth-user-id"),
) -> str | None:
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

    if not x_app_auth_user_id:
        return None

    try:
        return str(UUID(x_app_auth_user_id))
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Marketplace auth user id is invalid.",
        ) from error
