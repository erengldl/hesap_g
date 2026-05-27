BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

ALTER TABLE public.users
  ALTER COLUMN auth_user_id TYPE uuid
  USING NULLIF(auth_user_id::text, '')::uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id
  ON public.users(auth_user_id);

ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.product_marketplace_settings ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.cost_results ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.inventory_daily ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.demand_forecasts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.seo_generations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.price_optimization_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.store_expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.data_center_sync_runs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.campaign_profit_metrics ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_product_marketplace_settings_user_id ON public.product_marketplace_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_results_user_id ON public.cost_results(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_user_id ON public.order_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_daily_user_id ON public.inventory_daily(user_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_user_id ON public.demand_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_generations_user_id ON public.seo_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_user_id ON public.price_optimization_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_store_expenses_user_id ON public.store_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_data_center_sync_runs_user_id ON public.data_center_sync_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_profit_metrics_user_id ON public.campaign_profit_metrics(user_id);

CREATE OR REPLACE FUNCTION public.current_app_auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('app.current_auth_user_id', true), '')::uuid,
    auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.tg_apply_user_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  context_user_id uuid := public.current_app_auth_user_id();
BEGIN
  IF TG_TABLE_NAME = 'seller_profiles' THEN
    NEW.user_id := COALESCE(NEW.user_id, context_user_id);
  ELSIF TG_TABLE_NAME = 'products' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      context_user_id,
      (SELECT sp.user_id FROM public.seller_profiles sp WHERE sp.profile_id = NEW.profile_id)
    );
  ELSIF TG_TABLE_NAME = 'product_marketplace_settings' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'cost_results' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'orders' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT o.user_id FROM public.orders o WHERE o.order_id = NEW.order_id),
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'inventory_daily' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'demand_forecasts' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'seo_generations' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'price_optimization_runs' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'store_expenses' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT sp.user_id FROM public.seller_profiles sp WHERE sp.profile_id = NEW.profile_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME IN ('data_center_sync_runs', 'campaign_profit_metrics') THEN
    NEW.user_id := COALESCE(NEW.user_id, context_user_id);
  END IF;

  RETURN NEW;
END;
$$;

WITH default_owner AS (
  SELECT auth_user_id
  FROM public.users
  WHERE auth_user_id IS NOT NULL
  ORDER BY user_id ASC
  LIMIT 1
)
UPDATE public.seller_profiles sp
SET user_id = COALESCE(sp.user_id, (SELECT auth_user_id FROM default_owner))
WHERE sp.user_id IS NULL;

UPDATE public.products p
SET user_id = COALESCE(
  p.user_id,
  (SELECT sp.user_id FROM public.seller_profiles sp WHERE sp.profile_id = p.profile_id),
  (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL ORDER BY user_id ASC LIMIT 1)
)
WHERE p.user_id IS NULL;

UPDATE public.product_marketplace_settings pms
SET user_id = COALESCE(
  pms.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = pms.product_id)
)
WHERE pms.user_id IS NULL;

UPDATE public.cost_results cr
SET user_id = COALESCE(
  cr.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = cr.product_id)
)
WHERE cr.user_id IS NULL;

UPDATE public.orders o
SET user_id = COALESCE(
  o.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = o.product_id)
)
WHERE o.user_id IS NULL;

UPDATE public.order_items oi
SET user_id = COALESCE(
  oi.user_id,
  (SELECT o.user_id FROM public.orders o WHERE o.order_id = oi.order_id),
  (SELECT p.user_id FROM public.products p WHERE p.product_id = oi.product_id)
)
WHERE oi.user_id IS NULL;

UPDATE public.inventory_daily id
SET user_id = COALESCE(
  id.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = id.product_id)
)
WHERE id.user_id IS NULL;

UPDATE public.demand_forecasts df
SET user_id = COALESCE(
  df.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = df.product_id)
)
WHERE df.user_id IS NULL;

UPDATE public.seo_generations sg
SET user_id = COALESCE(
  sg.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = sg.product_id)
)
WHERE sg.user_id IS NULL;

UPDATE public.price_optimization_runs por
SET user_id = COALESCE(
  por.user_id,
  (SELECT p.user_id FROM public.products p WHERE p.product_id = por.product_id)
)
WHERE por.user_id IS NULL;

UPDATE public.store_expenses se
SET user_id = COALESCE(
  se.user_id,
  (SELECT sp.user_id FROM public.seller_profiles sp WHERE sp.profile_id = se.profile_id),
  (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL ORDER BY user_id ASC LIMIT 1)
)
WHERE se.user_id IS NULL;

UPDATE public.data_center_sync_runs dcsr
SET user_id = COALESCE(
  dcsr.user_id,
  (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL ORDER BY user_id ASC LIMIT 1)
)
WHERE dcsr.user_id IS NULL;

UPDATE public.campaign_profit_metrics cpm
SET user_id = COALESCE(
  cpm.user_id,
  (SELECT auth_user_id FROM public.users WHERE auth_user_id IS NOT NULL ORDER BY user_id ASC LIMIT 1)
)
WHERE cpm.user_id IS NULL;

DROP TRIGGER IF EXISTS trg_seller_profiles_apply_user_scope ON public.seller_profiles;
CREATE TRIGGER trg_seller_profiles_apply_user_scope
BEFORE INSERT OR UPDATE ON public.seller_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_products_apply_user_scope ON public.products;
CREATE TRIGGER trg_products_apply_user_scope
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_product_marketplace_settings_apply_user_scope ON public.product_marketplace_settings;
CREATE TRIGGER trg_product_marketplace_settings_apply_user_scope
BEFORE INSERT OR UPDATE ON public.product_marketplace_settings
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_cost_results_apply_user_scope ON public.cost_results;
CREATE TRIGGER trg_cost_results_apply_user_scope
BEFORE INSERT OR UPDATE ON public.cost_results
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_orders_apply_user_scope ON public.orders;
CREATE TRIGGER trg_orders_apply_user_scope
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_order_items_apply_user_scope ON public.order_items;
CREATE TRIGGER trg_order_items_apply_user_scope
BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_inventory_daily_apply_user_scope ON public.inventory_daily;
CREATE TRIGGER trg_inventory_daily_apply_user_scope
BEFORE INSERT OR UPDATE ON public.inventory_daily
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_demand_forecasts_apply_user_scope ON public.demand_forecasts;
CREATE TRIGGER trg_demand_forecasts_apply_user_scope
BEFORE INSERT OR UPDATE ON public.demand_forecasts
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_seo_generations_apply_user_scope ON public.seo_generations;
CREATE TRIGGER trg_seo_generations_apply_user_scope
BEFORE INSERT OR UPDATE ON public.seo_generations
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_price_optimization_runs_apply_user_scope ON public.price_optimization_runs;
CREATE TRIGGER trg_price_optimization_runs_apply_user_scope
BEFORE INSERT OR UPDATE ON public.price_optimization_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_store_expenses_apply_user_scope ON public.store_expenses;
CREATE TRIGGER trg_store_expenses_apply_user_scope
BEFORE INSERT OR UPDATE ON public.store_expenses
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_data_center_sync_runs_apply_user_scope ON public.data_center_sync_runs;
CREATE TRIGGER trg_data_center_sync_runs_apply_user_scope
BEFORE INSERT OR UPDATE ON public.data_center_sync_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DROP TRIGGER IF EXISTS trg_campaign_profit_metrics_apply_user_scope ON public.campaign_profit_metrics;
CREATE TRIGGER trg_campaign_profit_metrics_apply_user_scope
BEFORE INSERT OR UPDATE ON public.campaign_profit_metrics
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_user_scope();

DO $$
DECLARE
  table_name text;
  scoped_tables text[] := ARRAY[
    'seller_profiles',
    'products',
    'product_marketplace_settings',
    'cost_results',
    'orders',
    'order_items',
    'inventory_daily',
    'demand_forecasts',
    'seo_generations',
    'price_optimization_runs',
    'store_expenses',
    'data_center_sync_runs',
    'campaign_profit_metrics'
  ];
BEGIN
  FOREACH table_name IN ARRAY scoped_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_tenant_isolation ON public.%I', table_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I_tenant_isolation ON public.%I FOR ALL TO authenticated USING (user_id = public.current_app_auth_user_id()) WITH CHECK (user_id = public.current_app_auth_user_id())',
      table_name,
      table_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated';
  END IF;
END $$;

COMMIT;
