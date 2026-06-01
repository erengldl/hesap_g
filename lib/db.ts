import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { resolveDatabaseUrl } from './database-url';
import { resolveLocalDatabasePath } from './local-sqlite';
import { createRemoteDatabase, isRemoteDatabase } from './remote-db';

interface AppDatabase {
  prepare(sql: string): {
    all(...params: any[]): any[];
    get(...params: any[]): any;
    run(...params: any[]): any;
  };
  exec(sql: string): void;
  pragma?(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
}

let db: AppDatabase | null = null;
let schemaEnsured = false;
let remoteDatabaseConnectionFailed = false;
let databaseMode: "remote" | "sqlite" | "sqlite_snapshot" | "unavailable" = "unavailable";

function hasColumn(database: AppDatabase, table: string, column: string) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return columns.some((item) => item.name === column);
}

function ensureColumn(database: AppDatabase, table: string, column: string, definition: string) {
  if (!hasColumn(database, table, column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function isVercelRuntime() {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
}

function resetDatabaseState(mode: typeof databaseMode) {
  db = null;
  schemaEnsured = false;
  databaseMode = mode;
}

function openLocalDatabase() {
  const preferWritableCopy = isVercelRuntime();
  const databasePath = resolveLocalDatabasePath({ preferWritableCopy });

  if (!databasePath) {
    return null;
  }

  const localDb = new Database(databasePath, { readonly: false, fileMustExist: true }) as unknown as AppDatabase;
  localDb.pragma?.('foreign_keys = ON');
  ensureAppSchema(localDb);
  resetDatabaseState(preferWritableCopy ? "sqlite_snapshot" : "sqlite");
  return localDb;
}

function openRemoteDatabase() {
  const remoteDb = createRemoteDatabase() as AppDatabase;
  resetDatabaseState("remote");
  return remoteDb;
}

function switchToLocalFallback() {
  remoteDatabaseConnectionFailed = true;
  db = null;
  schemaEnsured = false;
  const fallbackDb = openLocalDatabase();
  if (fallbackDb) {
    db = fallbackDb;
  }
  return fallbackDb;
}

function ensureAppSchema(database: AppDatabase) {
  if (schemaEnsured) return;

  if (!hasColumn(database, 'products', 'status')) {
    database.exec("ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'active'");
  }

  if (!hasColumn(database, 'products', 'sku')) {
    database.exec("ALTER TABLE products ADD COLUMN sku TEXT");
  }

  if (!hasColumn(database, 'products', 'barcode')) {
    database.exec("ALTER TABLE products ADD COLUMN barcode TEXT");
  }

  if (!hasColumn(database, 'products', 'image_url')) {
    database.exec("ALTER TABLE products ADD COLUMN image_url TEXT");
  }

  if (!hasColumn(database, 'products', 'category_path')) {
    database.exec("ALTER TABLE products ADD COLUMN category_path TEXT");
  }

  if (!hasColumn(database, 'products', 'description')) {
    database.exec("ALTER TABLE products ADD COLUMN description TEXT");
  }

  if (!hasColumn(database, 'products', 'updated_at')) {
    database.exec("ALTER TABLE products ADD COLUMN updated_at DATETIME");
  }

  if (!hasColumn(database, 'payment_gateway_rules', 'manual_shipping_cost')) {
    database.exec("ALTER TABLE payment_gateway_rules ADD COLUMN manual_shipping_cost REAL DEFAULT 95");
  }

  if (!hasColumn(database, 'payment_gateway_rules', 'avg_ad_cost')) {
    database.exec("ALTER TABLE payment_gateway_rules ADD COLUMN avg_ad_cost REAL DEFAULT 56.2");
  }

  if (!hasColumn(database, 'payment_gateway_rules', 'avg_conversion_rate')) {
    database.exec("ALTER TABLE payment_gateway_rules ADD COLUMN avg_conversion_rate REAL DEFAULT 2.6");
  }

  if (!hasColumn(database, 'seller_profiles', 'tax_bracket')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN tax_bracket REAL DEFAULT 20");
  }

  if (!hasColumn(database, 'seller_profiles', 'monthly_fixed_expenses')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN monthly_fixed_expenses REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'marketplace_expenses')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN marketplace_expenses REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'operational_costs')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN operational_costs REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'default_margin_target')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN default_margin_target REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'default_commission')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN default_commission REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'default_packaging_cost')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN default_packaging_cost REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'seller_profiles', 'default_risk_threshold')) {
    database.exec("ALTER TABLE seller_profiles ADD COLUMN default_risk_threshold REAL DEFAULT NULL");
  }

  if (!hasColumn(database, 'payment_gateway_rules', 'packaging_behavior')) {
    database.exec("ALTER TABLE payment_gateway_rules ADD COLUMN packaging_behavior TEXT DEFAULT 'seller_pays'");
  }

  if (!hasColumn(database, 'payment_gateway_rules', 'free_shipping_threshold')) {
    database.exec("ALTER TABLE payment_gateway_rules ADD COLUMN free_shipping_threshold REAL DEFAULT 0");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS store_expenses (
      expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER DEFAULT 1,
      name TEXT NOT NULL,
      monthly_amount REAL NOT NULL DEFAULT 0,
      note TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS data_center_sync_runs (
      sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_scope TEXT NOT NULL DEFAULT 'all_products',
      product_count INTEGER NOT NULL DEFAULT 0,
      processed_products INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS price_optimization_runs (
      run_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      current_price REAL NOT NULL,
      recommended_price REAL NOT NULL,
      min_price_limit REAL NOT NULL,
      max_price_limit REAL NOT NULL,
      expected_demand_current REAL NOT NULL,
      expected_demand_recommended REAL NOT NULL,
      expected_profit_current REAL NOT NULL,
      expected_profit_recommended REAL NOT NULL,
      elasticity_estimate REAL NOT NULL,
      confidence_score TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      stock REAL NOT NULL DEFAULT 0,
      current_sales_volume REAL NOT NULL DEFAULT 0,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
    )
  `);

  database.exec(`
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
      recommended_min REAL,
      recommended_max REAL,
      recommended_preferred REAL,
      applied_at DATETIME,
      applied_old_price REAL,
      applied_new_price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      order_date DATE NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
    )
  `);

  if (!hasColumn(database, 'orders', 'external_order_number')) {
    database.exec("ALTER TABLE orders ADD COLUMN external_order_number TEXT");
  }
  if (!hasColumn(database, 'orders', 'external_package_number')) {
    database.exec("ALTER TABLE orders ADD COLUMN external_package_number TEXT");
  }
  if (!hasColumn(database, 'orders', 'external_line_item_id')) {
    database.exec("ALTER TABLE orders ADD COLUMN external_line_item_id TEXT");
  }
  if (!hasColumn(database, 'orders', 'merchant_sku')) {
    database.exec("ALTER TABLE orders ADD COLUMN merchant_sku TEXT");
  }
  if (!hasColumn(database, 'orders', 'barcode')) {
    database.exec("ALTER TABLE orders ADD COLUMN barcode TEXT");
  }
  if (!hasColumn(database, 'orders', 'buyer_name')) {
    database.exec("ALTER TABLE orders ADD COLUMN buyer_name TEXT");
  }
  if (!hasColumn(database, 'orders', 'order_status_detail')) {
    database.exec("ALTER TABLE orders ADD COLUMN order_status_detail TEXT");
  }
  if (!hasColumn(database, 'orders', 'currency_code')) {
    database.exec("ALTER TABLE orders ADD COLUMN currency_code TEXT DEFAULT 'TRY'");
  }
  if (!hasColumn(database, 'orders', 'gross_amount')) {
    database.exec("ALTER TABLE orders ADD COLUMN gross_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'discount_amount')) {
    database.exec("ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'shipping_amount')) {
    database.exec("ALTER TABLE orders ADD COLUMN shipping_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'commission_amount')) {
    database.exec("ALTER TABLE orders ADD COLUMN commission_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'realized_commission')) {
    database.exec("ALTER TABLE orders ADD COLUMN realized_commission REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'realized_shipping_cost')) {
    database.exec("ALTER TABLE orders ADD COLUMN realized_shipping_cost REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'settlement_transaction_type')) {
    database.exec("ALTER TABLE orders ADD COLUMN settlement_transaction_type TEXT");
  }
  if (!hasColumn(database, 'orders', 'raw_payload_json')) {
    database.exec("ALTER TABLE orders ADD COLUMN raw_payload_json TEXT");
  }
  if (!hasColumn(database, 'orders', 'last_synced_at')) {
    database.exec("ALTER TABLE orders ADD COLUMN last_synced_at DATETIME");
  }
  if (!hasColumn(database, 'orders', 'updated_at')) {
    database.exec("ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
  }
  if (!hasColumn(database, 'orders', 'campaign_id')) {
    database.exec("ALTER TABLE orders ADD COLUMN campaign_id TEXT");
  }
  if (!hasColumn(database, 'orders', 'campaign_name')) {
    database.exec("ALTER TABLE orders ADD COLUMN campaign_name TEXT");
  }
  if (!hasColumn(database, 'orders', 'utm_source')) {
    database.exec("ALTER TABLE orders ADD COLUMN utm_source TEXT");
  }
  if (!hasColumn(database, 'orders', 'utm_medium')) {
    database.exec("ALTER TABLE orders ADD COLUMN utm_medium TEXT");
  }
  if (!hasColumn(database, 'orders', 'utm_campaign')) {
    database.exec("ALTER TABLE orders ADD COLUMN utm_campaign TEXT");
  }
  if (!hasColumn(database, 'orders', 'platform_reported_revenue')) {
    database.exec("ALTER TABLE orders ADD COLUMN platform_reported_revenue REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'orders', 'platform_reported_roas')) {
    database.exec("ALTER TABLE orders ADD COLUMN platform_reported_roas REAL DEFAULT 0");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS marketplace_credentials (
      credential_id INTEGER PRIMARY KEY AUTOINCREMENT,
      marketplace_id INTEGER NOT NULL UNIQUE,
      merchant_id TEXT NOT NULL,
      encrypted_api_key TEXT NOT NULL,
      encrypted_api_secret TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_sync_time DATETIME,
      last_sync_scope TEXT,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      marketplace_order_number TEXT,
      package_number TEXT,
      external_order_line_id TEXT,
      merchant_sku TEXT,
      barcode TEXT,
      product_id INTEGER,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      commission_amount REAL DEFAULT 0,
      shipping_cost REAL DEFAULT 0,
      transaction_type TEXT,
      raw_payload_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS campaign_profit_metrics (
      metric_id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id TEXT NOT NULL UNIQUE,
      campaign_name TEXT NOT NULL,
      platform_slug TEXT NOT NULL,
      platform_label TEXT NOT NULL,
      utm_source TEXT,
      utm_campaign TEXT,
      window_start DATE NOT NULL,
      window_end DATE NOT NULL,
      spend REAL NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      platform_reported_revenue REAL NOT NULL DEFAULT 0,
      platform_reported_roas REAL NOT NULL DEFAULT 0,
      attributed_orders INTEGER NOT NULL DEFAULT 0,
      attributed_revenue REAL NOT NULL DEFAULT 0,
      gross_profit REAL NOT NULL DEFAULT 0,
      net_profit REAL NOT NULL DEFAULT 0,
      roas REAL NOT NULL DEFAULT 0,
      poas REAL NOT NULL DEFAULT 0,
      new_customers INTEGER NOT NULL DEFAULT 0,
      cac REAL NOT NULL DEFAULT 0,
      predicted_ltv REAL NOT NULL DEFAULT 0,
      ltv_cac_ratio REAL NOT NULL DEFAULT 0,
      health_status TEXT NOT NULL DEFAULT 'watch',
      action_label TEXT NOT NULL DEFAULT 'İzle',
      match_method TEXT NOT NULL DEFAULT 'derived',
      confidence_score REAL NOT NULL DEFAULT 0,
      efficiency_gap REAL NOT NULL DEFAULT 0,
      data_source TEXT NOT NULL DEFAULT 'derived',
      last_calculated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS manual_ad_campaigns (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_spend REAL NOT NULL,
      orders_from_ads INTEGER NOT NULL,
      revenue_from_ads REAL,
      product_name TEXT,
      product_sale_price REAL,
      estimated_product_cost REAL,
      estimated_product_profit REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS manual_ad_chat_messages (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES manual_ad_campaigns(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES manual_ad_campaigns(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS inventory_daily (
      inventory_id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      inventory_date DATE NOT NULL,
      stock_qty REAL NOT NULL DEFAULT 0,
      reserved_qty REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS demand_forecasts (
      forecast_id TEXT PRIMARY KEY,
      product_id INTEGER NOT NULL,
      marketplace_id INTEGER NOT NULL,
      forecast_date DATE NOT NULL,
      horizon_days INTEGER NOT NULL,
      predicted_units REAL NOT NULL,
      lower_bound REAL NOT NULL,
      upper_bound REAL NOT NULL,
      wmape REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id),
      FOREIGN KEY (marketplace_id) REFERENCES marketplaces(marketplace_id)
    )
  `);

  if (!hasColumn(database, 'demand_forecasts', 'horizon_days')) {
    database.exec("ALTER TABLE demand_forecasts ADD COLUMN horizon_days INTEGER NOT NULL DEFAULT 14");
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_type TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_url TEXT,
      target_label TEXT,
      status TEXT NOT NULL,
      overall_score REAL,
      data_coverage REAL DEFAULT 0,
      critical_issues_count INTEGER DEFAULT 0,
      warning_issues_count INTEGER DEFAULT 0,
      opportunities_count INTEGER DEFAULT 0,
      missing_meta_count INTEGER DEFAULT 0,
      schema_status TEXT DEFAULT 'insufficient_data',
      estimated_organic_potential REAL,
      source_hash TEXT NOT NULL,
      page_signal_json TEXT,
      context_json TEXT,
      generated_fields_json TEXT,
      ai_model_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_audit_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_field TEXT NOT NULL,
      current_value TEXT,
      recommended_value TEXT,
      reason TEXT,
      priority_score REAL DEFAULT 0,
      expected_impact TEXT,
      implementation_difficulty TEXT,
      evidence_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_keyword_research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      search_intent TEXT,
      volume REAL,
      difficulty REAL,
      cpc REAL,
      opportunity_score REAL DEFAULT 0,
      source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_ai_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      recommendation_type TEXT NOT NULL,
      current_value TEXT,
      suggested_value TEXT,
      explanation TEXT,
      confidence_score REAL DEFAULT 0,
      risk_level TEXT DEFAULT 'low',
      impact_score REAL DEFAULT 0,
      difficulty_score REAL DEFAULT 0,
      business_value_score REAL DEFAULT 0,
      priority_score REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      applied_at DATETIME,
      FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_schema_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      schema_type TEXT NOT NULL,
      json_ld TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      issues TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_internal_link_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      anchor_text TEXT NOT NULL,
      reason TEXT,
      priority_score REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audit_id) REFERENCES seo_audits(id) ON DELETE CASCADE
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_content_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_content TEXT,
      new_content TEXT,
      created_by TEXT,
      status TEXT DEFAULT 'draft',
      audit_id INTEGER,
      recommendation_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      plan TEXT DEFAULT 'Premium Plan',
      is_active INTEGER DEFAULT 1,
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      organization_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS organization_members (
      member_id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      organization_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      metadata_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Optional local-only bootstrap account for first-run testing
  const userCount = database.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number } | undefined;
  const shouldSeedDefaultAdmin =
    process.env.SEED_DEFAULT_ADMIN === "true" && process.env.NODE_ENV !== "production";
  if ((userCount?.count ?? 0) === 0 && shouldSeedDefaultAdmin) {
    const defaultHash = bcrypt.hashSync("admin123", 12);
    database.prepare("INSERT INTO users (email, password_hash, name, plan) VALUES (?, ?, ?, ?)").run(
      "admin@hesapg.com",
      defaultHash,
      "Eren Demir",
      "Premium Plan"
    );
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS seo_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      input_payload TEXT,
      output_payload TEXT,
      error_message TEXT,
      batch_id TEXT,
      source_hash TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS product_channel_seo_contents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  database.exec(`
    CREATE TABLE IF NOT EXISTS product_channel_seo_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  database.exec("CREATE INDEX IF NOT EXISTS idx_store_expenses_profile_status ON store_expenses(profile_id, status)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_data_center_sync_runs_created_at ON data_center_sync_runs(created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_product ON price_optimization_runs(product_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_marketplace ON price_optimization_runs(marketplace_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_created_at ON price_optimization_runs(created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_product ON profit_pricing_runs(product_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_created_at ON profit_pricing_runs(created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_profit_pricing_runs_channel ON profit_pricing_runs(channel, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_orders_product_marketplace_date ON orders(product_id, marketplace_id, order_date)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_unique ON orders(marketplace_id, external_order_number, external_line_item_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_orders_marketplace_status ON orders(marketplace_id, status)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_orders_external_package ON orders(external_package_number)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace ON marketplace_credentials(marketplace_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_marketplace_credentials_marketplace_active ON marketplace_credentials(marketplace_id, is_active)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_order_items_external_unique ON order_items(marketplace_order_number, external_order_line_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_profit_metrics_campaign_id ON campaign_profit_metrics(campaign_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_campaign_profit_metrics_status_spend ON campaign_profit_metrics(health_status, spend DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_campaign_profit_metrics_last_calculated_at ON campaign_profit_metrics(last_calculated_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_manual_ad_campaigns_user_created_at ON manual_ad_campaigns(user_id, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_manual_ad_chat_messages_campaign_created_at ON manual_ad_chat_messages(campaign_id, created_at ASC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_manual_ad_ai_reports_campaign_created_at ON manual_ad_ai_reports(campaign_id, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_inventory_daily_product_marketplace_date ON inventory_daily(product_id, marketplace_id, inventory_date)");
  database.exec("DROP INDEX IF EXISTS idx_demand_forecasts_product_marketplace_date");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_demand_forecasts_product_marketplace_date_horizon ON demand_forecasts(product_id, marketplace_id, forecast_date, horizon_days)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_generations_product_created_at ON seo_generations(product_id, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_audits_target_source ON seo_audits(target_type, target_id, audit_type, source_hash)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_audits_created_at ON seo_audits(created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_audit_issues_audit ON seo_audit_issues(audit_id, severity, priority_score DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_keyword_research_audit ON seo_keyword_research(audit_id, opportunity_score DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_ai_recommendations_audit ON seo_ai_recommendations(audit_id, priority_score DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_schema_suggestions_audit ON seo_schema_suggestions(audit_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_internal_link_suggestions_audit ON seo_internal_link_suggestions(audit_id, priority_score DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_jobs_status_created ON seo_jobs(status, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_seo_jobs_source_hash ON seo_jobs(source_hash)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_product_channel_seo_contents_unique ON product_channel_seo_contents(product_id, channel)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_product_channel_seo_contents_product_status ON product_channel_seo_contents(product_id, status, channel)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_product_channel_seo_contents_status_updated ON product_channel_seo_contents(status, updated_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_product_channel_seo_jobs_status_created ON product_channel_seo_jobs(status, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_organizations_owner ON organizations(owner_user_id)");
  database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_members_unique ON organization_members(organization_id, user_id)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_audit_logs_report_created ON audit_logs(report_id, created_at DESC)");

  ensureColumn(database, "seo_audits", "generated_fields_json", "TEXT");
  ensureColumn(database, "seo_keyword_research", "audit_id", "INTEGER");
  ensureColumn(database, "seo_ai_recommendations", "audit_id", "INTEGER");
  ensureColumn(database, "seo_schema_suggestions", "audit_id", "INTEGER");
  ensureColumn(database, "seo_internal_link_suggestions", "audit_id", "INTEGER");
  ensureColumn(database, "seo_content_versions", "audit_id", "INTEGER");
  ensureColumn(database, "seo_content_versions", "recommendation_id", "INTEGER");
  ensureColumn(database, "seo_jobs", "batch_id", "TEXT");
  ensureColumn(database, "seo_jobs", "source_hash", "TEXT");
  ensureColumn(database, "seo_jobs", "retry_count", "INTEGER DEFAULT 0");
  ensureColumn(database, "seo_jobs", "next_retry_at", "DATETIME");
  ensureColumn(database, "users", "company", "TEXT");
  ensureColumn(database, "users", "phone", "TEXT");
  ensureColumn(database, "product_marketplace_settings", "traffic_cpa", "REAL DEFAULT NULL");
  ensureColumn(database, "product_marketplace_settings", "buybox_price", "REAL DEFAULT NULL");
  ensureColumn(database, "price_optimization_runs", "status", "TEXT DEFAULT 'DRAFT'");
  ensureColumn(database, "price_optimization_runs", "stock", "REAL DEFAULT 0");
  ensureColumn(database, "price_optimization_runs", "current_sales_volume", "REAL DEFAULT 0");
  ensureColumn(database, "price_optimization_runs", "published_at", "DATETIME");
  database.exec("CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_status_created_at ON price_optimization_runs(status, created_at DESC)");
  database.exec("CREATE INDEX IF NOT EXISTS idx_price_optimization_runs_published_at ON price_optimization_runs(published_at DESC)");

  if (!hasColumn(database, 'cost_results', 'marketplace_slug')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN marketplace_slug TEXT");
  }
  if (!hasColumn(database, 'cost_results', 'marketplace_name')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN marketplace_name TEXT");
  }
  if (!hasColumn(database, 'cost_results', 'expected_return_cost')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN expected_return_cost REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'output_vat_amount')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN output_vat_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'input_vat_amount')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN input_vat_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'estimated_vat_payable')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN estimated_vat_payable REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'shipping_vat_amount')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN shipping_vat_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'income_tax_amount')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN income_tax_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'withholding_tax_amount')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN withholding_tax_amount REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'realized_commission')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN realized_commission REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'realized_shipping_cost')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN realized_shipping_cost REAL DEFAULT 0");
  }

  database.exec(`
    UPDATE price_optimization_runs
    SET status = UPPER(COALESCE(status, 'DRAFT')),
        stock = COALESCE(stock, 0),
        current_sales_volume = COALESCE(current_sales_volume, 0)
  `);
  if (!hasColumn(database, 'cost_results', 'ml_return_rate')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_return_rate REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'ml_predicted_return_cost')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_predicted_return_cost REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'ml_predicted_cpa')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_predicted_cpa REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'ml_shipping_multiplier')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_shipping_multiplier REAL DEFAULT 1");
  }
  if (!hasColumn(database, 'cost_results', 'ml_effective_shipping_cost')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_effective_shipping_cost REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'ml_effective_desi')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_effective_desi REAL DEFAULT 0");
  }
  if (!hasColumn(database, 'cost_results', 'ml_confidence')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_confidence TEXT");
  }
  if (!hasColumn(database, 'cost_results', 'ml_notes')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_notes TEXT");
  }
  if (!hasColumn(database, 'cost_results', 'ml_model_source')) {
    database.exec("ALTER TABLE cost_results ADD COLUMN ml_model_source TEXT");
  }

  database.exec(`
    UPDATE products
    SET status = COALESCE(status, 'active'),
        profile_id = COALESCE(profile_id, 1),
        updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
    WHERE profile_id IS NULL OR status IS NULL OR updated_at IS NULL
  `);

  database.exec(`
    UPDATE payment_gateway_rules
    SET seller_profile_id = COALESCE(seller_profile_id, 1),
        manual_shipping_cost = COALESCE(manual_shipping_cost, 95),
        avg_ad_cost = COALESCE(avg_ad_cost, 56.2),
        avg_conversion_rate = COALESCE(avg_conversion_rate, 2.6)
    WHERE marketplace_id = 3
  `);

  database.exec(`
    UPDATE seller_profiles
    SET tax_bracket = COALESCE(tax_bracket, 20)
    WHERE profile_id = 1
  `);

  database.exec(`
    UPDATE payment_gateway_rules
    SET packaging_behavior = COALESCE(packaging_behavior, 'seller_pays'),
        free_shipping_threshold = COALESCE(free_shipping_threshold, 0)
    WHERE marketplace_id = 3
  `);

  const storeExpenseCount = database.prepare("SELECT COUNT(*) as count FROM store_expenses").get() as { count: number } | undefined;
  if ((storeExpenseCount?.count ?? 0) === 0) {
    const legacyProfile = database.prepare(`
      SELECT
        profile_id,
        monthly_employee_cost,
        monthly_warehouse_cost,
        monthly_invoice_accounting_cost,
        monthly_other_expenses
      FROM seller_profiles
      WHERE profile_id = 1
      LIMIT 1
    `).get() as {
      profile_id: number;
      monthly_employee_cost: number | null;
      monthly_warehouse_cost: number | null;
      monthly_invoice_accounting_cost: number | null;
      monthly_other_expenses: number | null;
    } | undefined;

    if (legacyProfile) {
      const insertExpense = database.prepare(`
        INSERT INTO store_expenses (profile_id, name, monthly_amount, note, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      const legacyExpenses = [
        ["Çalışan Gideri", legacyProfile.monthly_employee_cost ?? 0],
        ["Depo Gideri", legacyProfile.monthly_warehouse_cost ?? 0],
        ["Muhasebe / Fatura Gideri", legacyProfile.monthly_invoice_accounting_cost ?? 0],
        ["Diğer Aylık Giderler", legacyProfile.monthly_other_expenses ?? 0],
      ] as const;

      for (const [name, amount] of legacyExpenses) {
        insertExpense.run(legacyProfile.profile_id, name, amount, "Başlangıç gideri", "active");
      }
    }
  }

  database.exec("DELETE FROM seller_profiles WHERE profile_id = 999");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_orders_status_order_date
      ON orders(status, order_date);

    CREATE INDEX IF NOT EXISTS idx_orders_product_marketplace
      ON orders(product_id, marketplace_id);

    CREATE INDEX IF NOT EXISTS idx_order_items_order_id
      ON order_items(order_id);

    CREATE INDEX IF NOT EXISTS idx_product_marketplace_settings_product_id
      ON product_marketplace_settings(product_id);

    CREATE INDEX IF NOT EXISTS idx_inventory_daily_inventory_date_stock_qty
      ON inventory_daily(inventory_date, stock_qty);

    CREATE INDEX IF NOT EXISTS idx_store_expenses_profile_status
      ON store_expenses(profile_id, status);

    CREATE INDEX IF NOT EXISTS idx_cost_results_product_id
      ON cost_results(product_id);

    CREATE INDEX IF NOT EXISTS idx_data_center_sync_runs_created_at
      ON data_center_sync_runs(created_at DESC, sync_id DESC);
  `);
  schemaEnsured = true;
}

export function getDb() {
  if (db) {
    return db;
  }

  const databaseUrl = resolveDatabaseUrl();
  const preferBundledSnapshot = isVercelRuntime() && process.env.FORCE_REMOTE_DATABASE !== 'true';

  if (preferBundledSnapshot) {
    const localDb = openLocalDatabase();
    if (localDb) {
      db = localDb;
      return db;
    }
  }

  if (remoteDatabaseConnectionFailed) {
    const fallbackDb = openLocalDatabase();
    if (fallbackDb) {
      db = fallbackDb;
      return db;
    }
    return null;
  }

  try {
    if (databaseUrl) {
      db = openRemoteDatabase();

      if (process.env.NODE_ENV !== 'production') {
        ensureAppSchema(db);
      }
    } else {
      db = openLocalDatabase();
      if (!db) {
        throw new Error("Bundled database snapshot not available");
      }
      ensureAppSchema(db);
    }
  } catch (error) {
    if (databaseUrl && process.env.NODE_ENV === 'production') {
      remoteDatabaseConnectionFailed = true;
      const fallbackDb = openLocalDatabase();
      if (fallbackDb) {
        db = fallbackDb;
        ensureAppSchema(db);
        return db;
      }
    }
    console.error('Failed to connect to database:', error);
    return null;
  }

  return db;
}

export function query<T>(sql: string, params: any[] = []): T[] {
  const database = getDb();
  if (!database) return [];
  try {
    return database.prepare(sql).all(...params) as T[];
  } catch (error) {
    if (isRemoteDatabase(database) && process.env.NODE_ENV === 'production') {
      const fallbackDb = switchToLocalFallback();
      if (fallbackDb) {
        try {
          return fallbackDb.prepare(sql).all(...params) as T[];
        } catch (fallbackError) {
          console.error(`Fallback query error: ${sql}`, fallbackError);
        }
      }
    }
    console.error(`Query error: ${sql}`, error);
    return [];
  }
}

export function getOne<T>(sql: string, params: any[] = []): T | null {
  const database = getDb();
  if (!database) return null;
  try {
    return database.prepare(sql).get(...params) as T || null;
  } catch (error) {
    if (isRemoteDatabase(database) && process.env.NODE_ENV === 'production') {
      const fallbackDb = switchToLocalFallback();
      if (fallbackDb) {
        try {
          return (fallbackDb.prepare(sql).get(...params) as T) || null;
        } catch (fallbackError) {
          console.error(`Fallback query error: ${sql}`, fallbackError);
        }
      }
    }
    console.error(`Query error: ${sql}`, error);
    return null;
  }
}

export function getDatabaseMode() {
  return databaseMode;
}
