from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


def _candidate_env_paths() -> list[Path]:
    app_dir = Path(__file__).resolve().parent
    service_dir = app_dir.parent
    project_root = service_dir.parent.parent
    return [
        project_root / ".env.local",
        project_root / ".env",
        service_dir / ".env.local",
        service_dir / ".env",
    ]


def _parse_env_file(path: Path) -> None:
    try:
        contents = path.read_text(encoding="utf-8")
    except OSError:
        return

    for raw_line in contents.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue

        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]

        os.environ.setdefault(key, value)


@lru_cache(maxsize=1)
def load_environment_files() -> None:
    for path in _candidate_env_paths():
        if path.exists():
            _parse_env_file(path)
