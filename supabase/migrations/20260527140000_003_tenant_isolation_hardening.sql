BEGIN;

ALTER TABLE public.profit_pricing_runs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.marketplace_credentials
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.seo_audits
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.seo_keyword_research
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

ALTER TABLE public.seo_ai_recommendations
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DO $$
DECLARE
  default_owner_id uuid;
BEGIN
  SELECT auth_user_id
  INTO default_owner_id
  FROM public.users
  WHERE auth_user_id IS NOT NULL
  ORDER BY user_id ASC
  LIMIT 1;

  UPDATE public.profit_pricing_runs ppr
  SET user_id = COALESCE(
    ppr.user_id,
    (SELECT p.user_id FROM public.products p WHERE p.product_id = ppr.product_id),
    default_owner_id
  )
  WHERE ppr.user_id IS NULL;

  UPDATE public.marketplace_credentials mc
  SET user_id = COALESCE(mc.user_id, default_owner_id)
  WHERE mc.user_id IS NULL;

  UPDATE public.seo_audits sa
  SET user_id = COALESCE(
    sa.user_id,
    CASE
      WHEN sa.target_type = 'product' AND sa.target_id ~ '^[0-9]+$'
        THEN (SELECT p.user_id FROM public.products p WHERE p.product_id = sa.target_id::int)
      ELSE NULL
    END,
    default_owner_id
  )
  WHERE sa.user_id IS NULL;

  UPDATE public.seo_keyword_research skr
  SET user_id = COALESCE(
    skr.user_id,
    (SELECT sa.user_id FROM public.seo_audits sa WHERE sa.id = skr.audit_id),
    default_owner_id
  )
  WHERE skr.user_id IS NULL;

  UPDATE public.seo_ai_recommendations sar
  SET user_id = COALESCE(
    sar.user_id,
    (SELECT sa.user_id FROM public.seo_audits sa WHERE sa.id = sar.audit_id),
    default_owner_id
  )
  WHERE sar.user_id IS NULL;
END
$$;

ALTER TABLE public.profit_pricing_runs
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.marketplace_credentials
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.seo_audits
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.seo_keyword_research
  ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.seo_ai_recommendations
  ALTER COLUMN user_id SET NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name
  INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'marketplace_credentials'
    AND tc.constraint_type = 'UNIQUE'
    AND ccu.column_name = 'marketplace_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.marketplace_credentials DROP CONSTRAINT %I', constraint_name);
  END IF;
END
$$;

DROP INDEX IF EXISTS public.idx_marketplace_credentials_marketplace;
DROP INDEX IF EXISTS public.idx_marketplace_credentials_marketplace_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_credentials_user_marketplace
  ON public.marketplace_credentials(user_id, marketplace_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_user_marketplace_active
  ON public.marketplace_credentials(user_id, marketplace_id, is_active);

CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_user_id
  ON public.marketplace_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_user_id
  ON public.profit_pricing_runs(user_id);

CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_user_created_at
  ON public.profit_pricing_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_audits_user_id
  ON public.seo_audits(user_id);

CREATE INDEX IF NOT EXISTS idx_seo_audits_user_created_at
  ON public.seo_audits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_research_user_id
  ON public.seo_keyword_research(user_id);

CREATE INDEX IF NOT EXISTS idx_seo_keyword_research_user_audit
  ON public.seo_keyword_research(user_id, audit_id, opportunity_score DESC);

CREATE INDEX IF NOT EXISTS idx_seo_ai_recommendations_user_id
  ON public.seo_ai_recommendations(user_id);

CREATE INDEX IF NOT EXISTS idx_seo_ai_recommendations_user_audit
  ON public.seo_ai_recommendations(user_id, audit_id, priority_score DESC);

CREATE OR REPLACE FUNCTION public.tg_apply_new_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  context_user_id uuid := public.current_app_auth_user_id();
BEGIN
  IF TG_TABLE_NAME = 'profit_pricing_runs' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.product_id),
      context_user_id
    );
  ELSIF TG_TABLE_NAME = 'marketplace_credentials' THEN
    NEW.user_id := COALESCE(NEW.user_id, context_user_id);
  ELSIF TG_TABLE_NAME = 'seo_audits' THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      CASE
        WHEN NEW.target_type = 'product' AND NEW.target_id ~ '^[0-9]+$'
          THEN (SELECT p.user_id FROM public.products p WHERE p.product_id = NEW.target_id::int)
        ELSE NULL
      END,
      context_user_id
    );
  ELSIF TG_TABLE_NAME IN ('seo_keyword_research', 'seo_ai_recommendations') THEN
    NEW.user_id := COALESCE(
      NEW.user_id,
      (SELECT sa.user_id FROM public.seo_audits sa WHERE sa.id = NEW.audit_id),
      context_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profit_pricing_runs_apply_user_scope ON public.profit_pricing_runs;
CREATE TRIGGER trg_profit_pricing_runs_apply_user_scope
BEFORE INSERT OR UPDATE ON public.profit_pricing_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_new_tenant_scope();

DROP TRIGGER IF EXISTS trg_marketplace_credentials_apply_user_scope ON public.marketplace_credentials;
CREATE TRIGGER trg_marketplace_credentials_apply_user_scope
BEFORE INSERT OR UPDATE ON public.marketplace_credentials
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_new_tenant_scope();

DROP TRIGGER IF EXISTS trg_seo_audits_apply_user_scope ON public.seo_audits;
CREATE TRIGGER trg_seo_audits_apply_user_scope
BEFORE INSERT OR UPDATE ON public.seo_audits
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_new_tenant_scope();

DROP TRIGGER IF EXISTS trg_seo_keyword_research_apply_user_scope ON public.seo_keyword_research;
CREATE TRIGGER trg_seo_keyword_research_apply_user_scope
BEFORE INSERT OR UPDATE ON public.seo_keyword_research
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_new_tenant_scope();

DROP TRIGGER IF EXISTS trg_seo_ai_recommendations_apply_user_scope ON public.seo_ai_recommendations;
CREATE TRIGGER trg_seo_ai_recommendations_apply_user_scope
BEFORE INSERT OR UPDATE ON public.seo_ai_recommendations
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_new_tenant_scope();

DO $$
DECLARE
  table_name text;
  scoped_tables text[] := ARRAY[
    'profit_pricing_runs',
    'marketplace_credentials',
    'seo_audits',
    'seo_keyword_research',
    'seo_ai_recommendations'
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
END
$$;

COMMIT;
