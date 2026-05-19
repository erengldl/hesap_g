-- One-off SQLite migration for demand_forecasts.
-- The live database snapshot already has horizon_days, so this script rebuilds the table
-- into the final shape and installs the horizon-aware unique index in one atomic flow.

BEGIN TRANSACTION;

DROP TABLE IF EXISTS demand_forecasts__migration_20260516;

CREATE TABLE demand_forecasts__migration_20260516 (
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
);

INSERT INTO demand_forecasts__migration_20260516 (
  forecast_id,
  product_id,
  marketplace_id,
  forecast_date,
  horizon_days,
  predicted_units,
  lower_bound,
  upper_bound,
  wmape,
  created_at
)
SELECT
  forecast_id,
  product_id,
  marketplace_id,
  forecast_date,
  horizon_days,
  predicted_units,
  lower_bound,
  upper_bound,
  wmape,
  created_at
FROM demand_forecasts;

DROP TABLE IF EXISTS demand_forecasts;
ALTER TABLE demand_forecasts__migration_20260516 RENAME TO demand_forecasts;

DROP INDEX IF EXISTS idx_demand_forecasts_product_marketplace_date;
CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_forecasts_product_marketplace_date_horizon
ON demand_forecasts(product_id, marketplace_id, forecast_date, horizon_days);

COMMIT;
