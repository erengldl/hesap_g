from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from .env import load_environment_files

load_environment_files()


@dataclass(frozen=True)
class Settings:
    service_token: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        service_token=os.getenv("MARKETPLACE_INTEGRATION_SERVICE_TOKEN", "").strip(),
    )
