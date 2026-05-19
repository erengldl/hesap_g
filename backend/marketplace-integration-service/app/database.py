from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .env import load_environment_files

load_environment_files()


class Base(DeclarativeBase):
    pass


def _default_database_url() -> str:
    root_dir = Path(__file__).resolve().parents[3]
    db_path = root_dir / "Veri Merkezi" / "kategoriagaci.db"
    return f"sqlite+aiosqlite:///{db_path.as_posix()}"


DATABASE_URL = os.getenv("DATABASE_URL", _default_database_url())
SQL_ECHO = os.getenv("SQL_ECHO", "0") == "1"

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=SQL_ECHO, future=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def _ensure_columns(connection, table: str, statements: list[tuple[str, str]]) -> None:
    result = await connection.execute(text(f"PRAGMA table_info({table})"))
    columns = {row[1] for row in result.fetchall()}
    if not columns:
        return

    for column_name, statement in statements:
        if column_name not in columns:
            await connection.execute(text(statement))


async def init_db() -> None:
    from . import models  # noqa: F401

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

        await _ensure_columns(
            connection,
            "products",
            [
                ("barcode", "ALTER TABLE products ADD COLUMN barcode TEXT"),
                ("description", "ALTER TABLE products ADD COLUMN description TEXT"),
            ],
        )

        await _ensure_columns(
            connection,
            "cost_results",
            [
                ("realized_commission", "ALTER TABLE cost_results ADD COLUMN realized_commission REAL DEFAULT 0"),
                ("realized_shipping_cost", "ALTER TABLE cost_results ADD COLUMN realized_shipping_cost REAL DEFAULT 0"),
            ],
        )

        await _ensure_columns(
            connection,
            "price_optimization_runs",
            [
                ("status", "ALTER TABLE price_optimization_runs ADD COLUMN status TEXT DEFAULT 'DRAFT'"),
                ("stock", "ALTER TABLE price_optimization_runs ADD COLUMN stock REAL DEFAULT 0"),
                ("current_sales_volume", "ALTER TABLE price_optimization_runs ADD COLUMN current_sales_volume REAL DEFAULT 0"),
                ("published_at", "ALTER TABLE price_optimization_runs ADD COLUMN published_at DATETIME"),
            ],
        )

        price_run_columns_result = await connection.execute(text("PRAGMA table_info(price_optimization_runs)"))
        price_run_columns = {row[1] for row in price_run_columns_result.fetchall()}
        if price_run_columns:
            await connection.execute(
                text(
                    """
                    UPDATE price_optimization_runs
                    SET status = UPPER(COALESCE(status, 'DRAFT')),
                        stock = COALESCE(stock, 0),
                        current_sales_volume = COALESCE(current_sales_volume, 0)
                    """
                )
            )

        await _ensure_columns(
            connection,
            "orders",
            [
                ("external_order_number", "ALTER TABLE orders ADD COLUMN external_order_number TEXT"),
                ("external_package_number", "ALTER TABLE orders ADD COLUMN external_package_number TEXT"),
                ("external_line_item_id", "ALTER TABLE orders ADD COLUMN external_line_item_id TEXT"),
                ("merchant_sku", "ALTER TABLE orders ADD COLUMN merchant_sku TEXT"),
                ("barcode", "ALTER TABLE orders ADD COLUMN barcode TEXT"),
                ("buyer_name", "ALTER TABLE orders ADD COLUMN buyer_name TEXT"),
                ("order_status_detail", "ALTER TABLE orders ADD COLUMN order_status_detail TEXT"),
                ("currency_code", "ALTER TABLE orders ADD COLUMN currency_code TEXT DEFAULT 'TRY'"),
                ("gross_amount", "ALTER TABLE orders ADD COLUMN gross_amount REAL DEFAULT 0"),
                ("discount_amount", "ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0"),
                ("shipping_amount", "ALTER TABLE orders ADD COLUMN shipping_amount REAL DEFAULT 0"),
                ("commission_amount", "ALTER TABLE orders ADD COLUMN commission_amount REAL DEFAULT 0"),
                ("realized_commission", "ALTER TABLE orders ADD COLUMN realized_commission REAL DEFAULT 0"),
                ("realized_shipping_cost", "ALTER TABLE orders ADD COLUMN realized_shipping_cost REAL DEFAULT 0"),
                ("settlement_transaction_type", "ALTER TABLE orders ADD COLUMN settlement_transaction_type TEXT"),
                ("raw_payload_json", "ALTER TABLE orders ADD COLUMN raw_payload_json TEXT"),
                ("last_synced_at", "ALTER TABLE orders ADD COLUMN last_synced_at DATETIME"),
                ("updated_at", "ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP"),
            ],
        )

        await connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_unique
                ON orders(marketplace_id, external_order_number, external_line_item_id)
                """
            )
        )
        await connection.execute(text("CREATE INDEX IF NOT EXISTS idx_orders_marketplace_status ON orders(marketplace_id, status)"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS idx_orders_external_package ON orders(external_package_number)"))
        if price_run_columns:
            await connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_status_created_at ON price_optimization_runs(status, created_at DESC)"
                )
            )
            await connection.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_published_at ON price_optimization_runs(published_at DESC)"
                )
            )
        await connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace
                ON marketplace_credentials(marketplace_id)
                """
            )
        )
        await connection.execute(
            text("CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace_active ON marketplace_credentials(marketplace_id, is_active)")
        )
        await connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_external_unique
                ON order_items(marketplace_order_number, external_order_line_id)
                """
            )
        )
        await connection.execute(text("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)"))
        await connection.execute(text("CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)"))

        await connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS demand_forecasts (
                  forecast_id TEXT PRIMARY KEY,
                  product_id INTEGER NOT NULL,
                  marketplace_id INTEGER NOT NULL,
                  forecast_date DATE NOT NULL,
                  horizon_days INTEGER NOT NULL DEFAULT 14,
                  predicted_units REAL NOT NULL,
                  lower_bound REAL NOT NULL,
                  upper_bound REAL NOT NULL,
                  wmape REAL NOT NULL,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (product_id) REFERENCES products(product_id),
                  FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
                )
                """
            )
        )
        await _ensure_columns(
            connection,
            "demand_forecasts",
            [
                ("horizon_days", "ALTER TABLE demand_forecasts ADD COLUMN horizon_days INTEGER NOT NULL DEFAULT 14"),
            ],
        )
        await connection.execute(text("DROP INDEX IF EXISTS idx_demand_forecasts_product_marketplace_date"))
        await connection.execute(
            text(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_forecasts_product_marketplace_date_horizon
                ON demand_forecasts(product_id, marketplace_id, forecast_date, horizon_days)
                """
            )
        )


@asynccontextmanager
async def lifespan_context(_app) -> AsyncIterator[None]:
    await init_db()
    try:
        yield
    finally:
        await engine.dispose()
