import type postgres from "postgres";
import bcrypt from "bcryptjs";

async function isPgSchemaReady(sql: postgres.Sql): Promise<boolean> {
  const rows = await sql<{
    has_products: boolean;
    has_orders: boolean;
    has_store_expenses: boolean;
    has_product_channel_seo_jobs: boolean;
    has_users_auth_user_id: boolean;
    has_cost_results_ml_return_rate: boolean;
  }[]>`
    SELECT
      to_regclass('public.products') IS NOT NULL AS has_products,
      to_regclass('public.orders') IS NOT NULL AS has_orders,
      to_regclass('public.store_expenses') IS NOT NULL AS has_store_expenses,
      to_regclass('public.product_channel_seo_jobs') IS NOT NULL AS has_product_channel_seo_jobs,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'auth_user_id'
      ) AS has_users_auth_user_id,
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'cost_results' AND column_name = 'ml_return_rate'
      ) AS has_cost_results_ml_return_rate
  `;

  const row = rows[0];
  return Boolean(
      row?.has_products &&
      row.has_orders &&
      row.has_store_expenses &&
      row.has_product_channel_seo_jobs &&
      row.has_users_auth_user_id &&
      row.has_cost_results_ml_return_rate
  );
}

function hasColumn(sql: postgres.Sql, table: string, column: string): Promise<boolean> {
  return sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${column}
    )
  `.then((rows) => Boolean(rows[0]?.exists ?? false));
}

async function ensureColumn(
  sql: postgres.Sql,
  table: string,
  column: string,
  definition: string
) {
  if (!(await hasColumn(sql, table, column))) {
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
  }
}

export async function initializePgSchema(sql: postgres.Sql) {
  if (await isPgSchemaReady(sql)) {
    return;
  }

  // Core tables
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS products (
      product_id SERIAL PRIMARY KEY,
      profile_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      category_id INTEGER,
      cost DOUBLE PRECISION DEFAULT 0,
      packaging_cost DOUBLE PRECISION DEFAULT 0,
      desi DOUBLE PRECISION DEFAULT 1,
      sale_price DOUBLE PRECISION DEFAULT 0,
      active_channels TEXT DEFAULT '["own_website"]',
      status TEXT DEFAULT 'active',
      sku TEXT,
      barcode TEXT,
      image_url TEXT,
      category_path TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      parent_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS marketplaces (
      marketplace_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      commission_rate DOUBLE PRECISION DEFAULT 0,
      shipping_fee DOUBLE PRECISION DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS shipping_companies (
      shipping_company_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS shipping_tariffs (
      tariff_id SERIAL PRIMARY KEY,
      shipping_company_id INTEGER NOT NULL,
      desi_min DOUBLE PRECISION DEFAULT 0,
      desi_max DOUBLE PRECISION DEFAULT 100,
      base_cost DOUBLE PRECISION DEFAULT 0,
      per_desi_cost DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS payment_gateway_rules (
      id SERIAL PRIMARY KEY,
      seller_profile_id INTEGER DEFAULT 1,
      marketplace_id INTEGER NOT NULL,
      gateway_name TEXT NOT NULL DEFAULT 'Kullanici Tanimli Odeme Altyapisi',
      fee_rate_percent DOUBLE PRECISION DEFAULT 3.49,
      fixed_fee_per_order DOUBLE PRECISION DEFAULT 0.25,
      vat_rate_percent DOUBLE PRECISION DEFAULT 20,
      fee_values_include_vat INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      manual_shipping_cost DOUBLE PRECISION DEFAULT 95,
      avg_ad_cost DOUBLE PRECISION DEFAULT 56.2,
      avg_conversion_rate DOUBLE PRECISION DEFAULT 2.6,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seller_profiles (
      profile_id SERIAL PRIMARY KEY,
      company_type TEXT DEFAULT 'Sahis Sirketi',
      monthly_employee_cost DOUBLE PRECISION DEFAULT 0,
      monthly_warehouse_cost DOUBLE PRECISION DEFAULT 0,
      monthly_invoice_accounting_cost DOUBLE PRECISION DEFAULT 0,
      monthly_other_expenses DOUBLE PRECISION DEFAULT 0,
      expected_monthly_order_count INTEGER DEFAULT 0,
      tax_bracket DOUBLE PRECISION DEFAULT 20,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS product_marketplace_settings (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      min_price DOUBLE PRECISION,
      max_price DOUBLE PRECISION,
      current_price DOUBLE PRECISION,
      stock_qty DOUBLE PRECISION DEFAULT 0,
      traffic_cpa DOUBLE PRECISION,
      buybox_price DOUBLE PRECISION,
      UNIQUE(product_id, marketplace_id)
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS cost_results (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER,
      channel TEXT DEFAULT 'own_website',
      sale_price DOUBLE PRECISION DEFAULT 0,
      commission_cost DOUBLE PRECISION DEFAULT 0,
      shipping_cost DOUBLE PRECISION DEFAULT 0,
      payment_gateway_cost DOUBLE PRECISION DEFAULT 0,
      packaging_cost DOUBLE PRECISION DEFAULT 0,
      fixed_cost_per_unit DOUBLE PRECISION DEFAULT 0,
      ad_cost_per_unit DOUBLE PRECISION DEFAULT 0,
      total_unit_cost DOUBLE PRECISION DEFAULT 0,
      net_margin DOUBLE PRECISION DEFAULT 0,
      net_margin_percent DOUBLE PRECISION DEFAULT 0,
      marketplace_slug TEXT,
      marketplace_name TEXT,
      expected_return_cost DOUBLE PRECISION DEFAULT 0,
      output_vat_amount DOUBLE PRECISION DEFAULT 0,
      input_vat_amount DOUBLE PRECISION DEFAULT 0,
      estimated_vat_payable DOUBLE PRECISION DEFAULT 0,
      shipping_vat_amount DOUBLE PRECISION DEFAULT 0,
      income_tax_amount DOUBLE PRECISION DEFAULT 0,
      withholding_tax_amount DOUBLE PRECISION DEFAULT 0,
      realized_commission DOUBLE PRECISION DEFAULT 0,
      realized_shipping_cost DOUBLE PRECISION DEFAULT 0,
      ml_return_rate DOUBLE PRECISION DEFAULT 0,
      ml_predicted_return_cost DOUBLE PRECISION DEFAULT 0,
      ml_predicted_cpa DOUBLE PRECISION DEFAULT 0,
      ml_shipping_multiplier DOUBLE PRECISION DEFAULT 1,
      ml_effective_shipping_cost DOUBLE PRECISION DEFAULT 0,
      ml_effective_desi DOUBLE PRECISION DEFAULT 0,
      ml_confidence TEXT,
      ml_notes TEXT,
      ml_model_source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS store_expenses (
      expense_id SERIAL PRIMARY KEY,
      profile_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      monthly_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
      note TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS data_center_sync_runs (
      sync_id SERIAL PRIMARY KEY,
      sync_scope TEXT NOT NULL DEFAULT 'all_products',
      product_count INTEGER NOT NULL DEFAULT 0,
      processed_products INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS price_optimization_runs (
      run_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      current_price DOUBLE PRECISION NOT NULL,
      recommended_price DOUBLE PRECISION NOT NULL,
      min_price_limit DOUBLE PRECISION NOT NULL,
      max_price_limit DOUBLE PRECISION NOT NULL,
      expected_demand_current DOUBLE PRECISION NOT NULL,
      expected_demand_recommended DOUBLE PRECISION NOT NULL,
      expected_profit_current DOUBLE PRECISION NOT NULL,
      expected_profit_recommended DOUBLE PRECISION NOT NULL,
      elasticity_estimate DOUBLE PRECISION NOT NULL,
      confidence_score TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      stock DOUBLE PRECISION NOT NULL DEFAULT 0,
      current_sales_volume DOUBLE PRECISION NOT NULL DEFAULT 0,
      published_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS profit_pricing_runs (
      run_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      marketplace_id INTEGER,
      note TEXT,
      input_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      decision TEXT NOT NULL,
      data_quality TEXT NOT NULL,
      recommended_min DOUBLE PRECISION,
      recommended_max DOUBLE PRECISION,
      recommended_preferred DOUBLE PRECISION,
      applied_at TIMESTAMP,
      applied_old_price DOUBLE PRECISION,
      applied_new_price DOUBLE PRECISION,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      order_date DATE NOT NULL,
      quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
      unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      external_order_number TEXT,
      external_package_number TEXT,
      external_line_item_id TEXT,
      merchant_sku TEXT,
      barcode TEXT,
      buyer_name TEXT,
      order_status_detail TEXT,
      currency_code TEXT DEFAULT 'TRY',
      gross_amount DOUBLE PRECISION DEFAULT 0,
      discount_amount DOUBLE PRECISION DEFAULT 0,
      shipping_amount DOUBLE PRECISION DEFAULT 0,
      commission_amount DOUBLE PRECISION DEFAULT 0,
      realized_commission DOUBLE PRECISION DEFAULT 0,
      realized_shipping_cost DOUBLE PRECISION DEFAULT 0,
      settlement_transaction_type TEXT,
      raw_payload_json TEXT,
      last_synced_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      campaign_id TEXT,
      campaign_name TEXT,
      utm_source TEXT,
      utm_medium TEXT,
      utm_campaign TEXT,
      platform_reported_revenue DOUBLE PRECISION DEFAULT 0,
      platform_reported_roas DOUBLE PRECISION DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS marketplace_credentials (
      credential_id SERIAL PRIMARY KEY,
      marketplace_id INTEGER NOT NULL UNIQUE,
      merchant_id TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      encrypted_api_secret TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_sync_time TIMESTAMP,
      last_sync_scope TEXT,
      last_error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS order_items (
      order_item_id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL,
      marketplace_order_number TEXT,
      package_number TEXT,
      external_order_line_id TEXT,
      merchant_sku TEXT,
      barcode TEXT,
      product_id INTEGER,
      quantity DOUBLE PRECISION NOT NULL DEFAULT 1,
      unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
      line_total DOUBLE PRECISION NOT NULL DEFAULT 0,
      commission_amount DOUBLE PRECISION DEFAULT 0,
      shipping_cost DOUBLE PRECISION DEFAULT 0,
      transaction_type TEXT,
      raw_payload_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS campaign_profit_metrics (
      metric_id SERIAL PRIMARY KEY,
      campaign_id TEXT NOT NULL UNIQUE,
      campaign_name TEXT NOT NULL,
      platform_slug TEXT NOT NULL,
      platform_label TEXT NOT NULL,
      utm_source TEXT,
      utm_campaign TEXT,
      window_start DATE NOT NULL,
      window_end DATE NOT NULL,
      spend DOUBLE PRECISION NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      platform_reported_revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
      platform_reported_roas DOUBLE PRECISION NOT NULL DEFAULT 0,
      attributed_orders INTEGER NOT NULL DEFAULT 0,
      attributed_revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
      gross_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
      net_profit DOUBLE PRECISION NOT NULL DEFAULT 0,
      roas DOUBLE PRECISION NOT NULL DEFAULT 0,
      poas DOUBLE PRECISION NOT NULL DEFAULT 0,
      new_customers INTEGER NOT NULL DEFAULT 0,
      cac DOUBLE PRECISION NOT NULL DEFAULT 0,
      predicted_ltv DOUBLE PRECISION NOT NULL DEFAULT 0,
      ltv_cac_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
      health_status TEXT NOT NULL DEFAULT 'watch',
      action_label TEXT NOT NULL DEFAULT 'Izle',
      match_method TEXT NOT NULL DEFAULT 'derived',
      confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
      efficiency_gap DOUBLE PRECISION NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'derived',
      last_calculated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS manual_ad_campaigns (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_spend DOUBLE PRECISION NOT NULL,
      orders_from_ads INTEGER NOT NULL,
      revenue_from_ads DOUBLE PRECISION,
      product_name TEXT,
      product_sale_price DOUBLE PRECISION,
      estimated_product_cost DOUBLE PRECISION,
      estimated_product_profit DOUBLE PRECISION,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS manual_ad_chat_messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS manual_ad_ai_reports (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      score INTEGER NOT NULL,
      summary TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      conversation_state_json TEXT NOT NULL,
      analysis_json TEXT NOT NULL,
      recommendations_json TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS inventory_daily (
      inventory_id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      inventory_date DATE NOT NULL,
      stock_qty DOUBLE PRECISION NOT NULL DEFAULT 0,
      reserved_qty DOUBLE PRECISION NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS demand_forecasts (
      forecast_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      forecast_date DATE NOT NULL,
      horizon_days INTEGER NOT NULL,
      predicted_units DOUBLE PRECISION NOT NULL,
      lower_bound DOUBLE PRECISION NOT NULL,
      upper_bound DOUBLE PRECISION NOT NULL,
      wmape DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_generations (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL,
      model_name TEXT NOT NULL,
      input_keywords TEXT NOT NULL,
      tone TEXT NOT NULL,
      audience TEXT,
      meta_title TEXT NOT NULL,
      meta_description TEXT NOT NULL,
      slug TEXT NOT NULL,
      h1_heading TEXT NOT NULL,
      html_content TEXT NOT NULL,
      faq_json TEXT NOT NULL,
      json_ld TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_audits (
      id SERIAL PRIMARY KEY,
      audit_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_url TEXT,
      target_label TEXT,
      status TEXT NOT NULL,
      overall_score DOUBLE PRECISION,
      data_coverage DOUBLE PRECISION DEFAULT 0,
      critical_issues_count INTEGER DEFAULT 0,
      warning_issues_count INTEGER DEFAULT 0,
      opportunities_count INTEGER DEFAULT 0,
      missing_meta_count INTEGER DEFAULT 0,
      schema_status TEXT DEFAULT 'insufficient_data',
      estimated_organic_potential DOUBLE PRECISION,
      source_hash TEXT NOT NULL,
      page_signal_json TEXT,
      context_json TEXT,
      generated_fields_json TEXT,
      ai_model_name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_audit_issues (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_field TEXT NOT NULL,
      current_value TEXT,
      recommended_value TEXT,
      reason TEXT,
      priority_score DOUBLE PRECISION DEFAULT 0,
      expected_impact TEXT,
      implementation_difficulty TEXT,
      evidence_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_keyword_research (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      search_intent TEXT,
      volume DOUBLE PRECISION,
      difficulty DOUBLE PRECISION,
      cpc DOUBLE PRECISION,
      opportunity_score DOUBLE PRECISION DEFAULT 0,
      source TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_ai_recommendations (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      recommendation_type TEXT NOT NULL,
      current_value TEXT,
      suggested_value TEXT,
      explanation TEXT,
      confidence_score DOUBLE PRECISION DEFAULT 0,
      risk_level TEXT DEFAULT 'low',
      impact_score DOUBLE PRECISION DEFAULT 0,
      difficulty_score DOUBLE PRECISION DEFAULT 0,
      business_value_score DOUBLE PRECISION DEFAULT 0,
      priority_score DOUBLE PRECISION DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      applied_at TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_schema_suggestions (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      schema_type TEXT NOT NULL,
      json_ld TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      issues TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_internal_link_suggestions (
      id SERIAL PRIMARY KEY,
      audit_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      anchor_text TEXT NOT NULL,
      reason TEXT,
      priority_score DOUBLE PRECISION DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_content_versions (
      id SERIAL PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_content TEXT,
      new_content TEXT,
      created_by TEXT,
      status TEXT DEFAULT 'draft',
      audit_id INTEGER,
      recommendation_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT DEFAULT 'Premium Plan',
      is_active INTEGER DEFAULT 1,
      last_login_at TIMESTAMP,
      company TEXT,
      phone TEXT,
      firebase_uid TEXT UNIQUE,
      auth_user_id TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS organizations (
      organization_id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS organization_members (
      member_id SERIAL PRIMARY KEY,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id SERIAL PRIMARY KEY,
      report_id INTEGER,
      organization_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS seo_jobs (
      id SERIAL PRIMARY KEY,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      input_payload TEXT,
      output_payload TEXT,
      error_message TEXT,
      batch_id TEXT,
      source_hash TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS product_channel_seo_contents (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      seo_score INTEGER,
      warnings_json TEXT,
      notes_json TEXT,
      keywords_json TEXT,
      generated_by TEXT,
      model TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      optimized_at TEXT,
      UNIQUE(product_id, channel)
    )
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS product_channel_seo_jobs (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL,
      total_count INTEGER NOT NULL,
      success_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      model TEXT,
      channels_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )
  `);

  // Indexes
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_store_expenses_profile_status ON store_expenses(profile_id, status)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_data_center_sync_runs_created_at ON data_center_sync_runs(created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_product ON price_optimization_runs(product_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_marketplace ON price_optimization_runs(marketplace_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_created_at ON price_optimization_runs(created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_product ON profit_pricing_runs(product_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_created_at ON profit_pricing_runs(created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_channel ON profit_pricing_runs(channel, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_orders_product_marketplace_date ON orders(product_id, marketplace_id, order_date)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_unique ON orders(marketplace_id, external_order_number, external_line_item_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_orders_marketplace_status ON orders(marketplace_id, status)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_orders_external_package ON orders(external_package_number)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace ON marketplace_credentials(marketplace_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace_active ON marketplace_credentials(marketplace_id, is_active)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_external_unique ON order_items(marketplace_order_number, external_order_line_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_profit_metrics_campaign_id ON campaign_profit_metrics(campaign_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_campaign_profit_metrics_status_spend ON campaign_profit_metrics(health_status, spend DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_campaign_profit_metrics_last_calculated_at ON campaign_profit_metrics(last_calculated_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_manual_ad_campaigns_user_created_at ON manual_ad_campaigns(user_id, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_manual_ad_chat_messages_campaign_created_at ON manual_ad_chat_messages(campaign_id, created_at ASC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_manual_ad_ai_reports_campaign_created_at ON manual_ad_ai_reports(campaign_id, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_inventory_daily_product_marketplace_date ON inventory_daily(product_id, marketplace_id, inventory_date)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_forecasts_product_marketplace_date_horizon ON demand_forecasts(product_id, marketplace_id, forecast_date, horizon_days)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_generations_product_created_at ON seo_generations(product_id, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_audits_target_source ON seo_audits(target_type, target_id, audit_type, source_hash)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_audits_created_at ON seo_audits(created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_audit_issues_audit ON seo_audit_issues(audit_id, severity, priority_score DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_keyword_research_audit ON seo_keyword_research(audit_id, opportunity_score DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_ai_recommendations_audit ON seo_ai_recommendations(audit_id, priority_score DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_schema_suggestions_audit ON seo_schema_suggestions(audit_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_internal_link_suggestions_audit ON seo_internal_link_suggestions(audit_id, priority_score DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_jobs_status_created ON seo_jobs(status, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_seo_jobs_source_hash ON seo_jobs(source_hash)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_product_channel_seo_contents_unique ON product_channel_seo_contents(product_id, channel)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_product_channel_seo_contents_product_status ON product_channel_seo_contents(product_id, status, channel)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_product_channel_seo_contents_status_updated ON product_channel_seo_contents(status, updated_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_product_channel_seo_jobs_status_created ON product_channel_seo_jobs(status, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_unique ON organization_members(organization_id, user_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_audit_logs_report_created ON audit_logs(report_id, created_at DESC)`);
  await ensureColumn(sql, "users", "firebase_uid", "TEXT");
  await ensureColumn(sql, "users", "auth_user_id", "TEXT");
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`);
  await sql.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_status_created_at ON price_optimization_runs(status, created_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_published_at ON price_optimization_runs(published_at DESC)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_orders_status_order_date ON orders(status, order_date)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_orders_product_marketplace ON orders(product_id, marketplace_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_product_marketplace_settings_product_id ON product_marketplace_settings(product_id)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_inventory_daily_inventory_date_stock_qty ON inventory_daily(inventory_date, stock_qty)`);
  await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_cost_results_product_id ON cost_results(product_id)`);

  // Seed default admin user (only in dev with SEED_DEFAULT_ADMIN=true)
  if (process.env.SEED_DEFAULT_ADMIN === "true" && process.env.NODE_ENV !== "production") {
    const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM users`;
    if (count === 0) {
      const defaultHash = bcrypt.hashSync("admin123", 12);
      await sql`INSERT INTO users (email, password_hash, name, plan) VALUES (${"admin@hesapg.com"}, ${defaultHash}, ${"Eren Demir"}, ${"Premium Plan"})`;
    }
  }

  // Migrate legacy seller profile expenses to store_expenses
  const [{ count: expenseCount }] = await sql`SELECT COUNT(*)::int as count FROM store_expenses`;
  if (expenseCount === 0) {
    const legacyProfile = await sql`
      SELECT profile_id, monthly_employee_cost, monthly_warehouse_cost, monthly_invoice_accounting_cost, monthly_other_expenses
      FROM seller_profiles WHERE profile_id = 1 LIMIT 1
    `.then((rows) => rows[0] as Record<string, unknown> | undefined);

    if (legacyProfile) {
      const expenses = [
        ["Calisan Gideri", legacyProfile.monthly_employee_cost as number ?? 0],
        ["Depo Gideri", legacyProfile.monthly_warehouse_cost as number ?? 0],
        ["Muhasebe / Fatura Gideri", legacyProfile.monthly_invoice_accounting_cost as number ?? 0],
        ["Diger Aylik Giderler", legacyProfile.monthly_other_expenses as number ?? 0],
      ] as const;

      for (const [name, amount] of expenses) {
        await sql`INSERT INTO store_expenses (profile_id, name, monthly_amount, note, status) VALUES (${legacyProfile.profile_id as number}, ${name}, ${amount}, ${"Baslangic gideri"}, ${"active"})`;
      }
    }
  }
}
