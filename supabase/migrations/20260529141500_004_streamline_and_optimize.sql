BEGIN;

-- 1. Drop unused tables (using CASCADE to remove related constraints/indexes automatically)
DROP TABLE IF EXISTS public.uploaded_reports CASCADE;
DROP TABLE IF EXISTS public.report_column_mappings CASCADE;
DROP TABLE IF EXISTS public.normalized_ad_rows CASCADE;
DROP TABLE IF EXISTS public.analysis_settings CASCADE;
DROP TABLE IF EXISTS public.analysis_results CASCADE;
DROP TABLE IF EXISTS public.recommendations CASCADE;
DROP TABLE IF EXISTS public.llm_outputs CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.seo_schema_suggestions CASCADE;
DROP TABLE IF EXISTS public.seo_internal_link_suggestions CASCADE;
DROP TABLE IF EXISTS public.seo_content_versions CASCADE;
DROP TABLE IF EXISTS public.seo_jobs CASCADE;
DROP TABLE IF EXISTS public.shipping_tariffs CASCADE;

-- 2. Drop duplicate indexes
DROP INDEX IF EXISTS public.idx_campaign_profit_metrics_campaign_id;
DROP INDEX IF EXISTS public.idx_product_channel_seo_contents_unique;

-- 3. Create missing foreign key indexes to optimize performance
CREATE INDEX IF NOT EXISTS idx_cost_results_marketplace_id ON public.cost_results(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_cost_results_payment_gateway_rule_id ON public.cost_results(payment_gateway_rule_id);
CREATE INDEX IF NOT EXISTS idx_cost_results_shipping_company_id ON public.cost_results(shipping_company_id);
CREATE INDEX IF NOT EXISTS idx_demand_forecasts_marketplace_id ON public.demand_forecasts(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_inventory_daily_marketplace_id ON public.inventory_daily(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_shipping_options_shipping_company_id ON public.marketplace_shipping_options(shipping_company_id);
CREATE INDEX IF NOT EXISTS idx_product_marketplace_settings_shipping_company_id ON public.product_marketplace_settings(shipping_company_id);
CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_marketplace_id ON public.profit_pricing_runs(marketplace_id);
CREATE INDEX IF NOT EXISTS idx_shipping_rate_rules_shipping_company_id ON public.shipping_rate_rules(shipping_company_id);

-- 4. Secure SECURITY DEFINER function from public execution
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;';
  END IF;
END $$;

-- 5. Harden function search_paths to resolve mutable search_path alerts
ALTER FUNCTION public.current_app_auth_user_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_apply_user_scope() SET search_path = public, pg_temp;
ALTER FUNCTION public.tg_apply_new_tenant_scope() SET search_path = public, pg_temp;

COMMIT;
