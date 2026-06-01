import { query, getOne } from './db';
import type { Marketplace, Product } from './types';

type RawMarketplaceRow = {
  id: number;
  name: string;
  slug: string;
};

type RawProductRow = {
  id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  category_id: number | null;
  profile_id: number | null;
  category_name: string | null;
  category_path: string | null;
  description: string | null;
  cost: number | null;
  packaging_cost: number | null;
  desi: number | null;
  status: string | null;
  stock_qty: number | null;
  profit_margin_percent?: number | null;
  updated_at?: string | null;
};

type ProductMarketplaceSettingRow = {
  product_id: number;
  sale_price: number | null;
  buybox_price?: number | null;
  marketplace_slug: string | null;
  marketplace_name: string | null;
  shipping_mode: string | null;
  shipping_company_id?: number | null;
  manual_shipping_cost?: number | null;
  payment_gateway_rule_id?: number | null;
  traffic_cpa?: number | null;
};

type ProfitPricingProductOptionRow = {
  id: number;
  name: string;
  sku: string | null;
  marketplace_slug: string | null;
};

type StoreExpenseRow = {
  expense_id: number;
  profile_id: number | null;
  name: string;
  monthly_amount: number | null;
  note: string | null;
  status: string | null;
};

function normalizeChannelSlug(slug: string | null | undefined) {
  if (!slug) return null;

  if (slug === 'own_website' || slug === 'own-website' || slug === 'website') {
    return 'my_website';
  }

  return slug;
}

function toActiveChannels(rows: ProductMarketplaceSettingRow[]) {
  return Array.from(
    new Set(
      rows
        .map((setting) => normalizeChannelSlug(setting.marketplace_slug))
        .filter((channel): channel is string => Boolean(channel))
    )
  );
}

function averageSalePrice(rows: ProductMarketplaceSettingRow[]) {
  const salePrices = rows
    .map((setting) => Number(setting.sale_price ?? 0))
    .filter((price) => Number.isFinite(price));

  return salePrices.length > 0
    ? salePrices.reduce((sum, price) => sum + price, 0) / salePrices.length
    : 0;
}

function toProduct(row: RawProductRow, productSettings: ProductMarketplaceSettingRow[]): Product {
  const activeChannels = toActiveChannels(productSettings);

  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? undefined,
    barcode: row.barcode ?? row.sku ?? undefined,
    image_url: row.image_url ?? undefined,
    category_id: row.category_id ?? undefined,
    profile_id: row.profile_id ?? undefined,
    category_name: row.category_name ?? undefined,
    category_path: row.category_path ?? row.category_name ?? undefined,
    description: row.description ?? undefined,
    cost: Number(row.cost ?? 0),
    packaging_cost: Number(row.packaging_cost ?? 0),
    desi: Number(row.desi ?? 0),
    sale_price: averageSalePrice(productSettings),
    stock: Number(row.stock_qty ?? 0),
    active_channels: activeChannels,
    status: row.status ?? (activeChannels.length > 0 ? 'active' : 'draft'),
    profit_margin_percent:
      row.profit_margin_percent == null || !Number.isFinite(Number(row.profit_margin_percent))
        ? undefined
        : Number(row.profit_margin_percent),
    last_updated: row.updated_at ?? undefined,
    status_label: row.status === 'passive'
      ? 'Pasif'
      : row.status === 'draft'
        ? 'Taslak'
        : 'Aktif',
  };
}

export function getProfitPricingProductOptions() {
  const rows = query<ProfitPricingProductOptionRow>(`
    SELECT
      p.product_id AS id,
      p.name,
      p.sku,
      m.slug AS marketplace_slug
    FROM products p
    LEFT JOIN product_marketplace_settings ms ON ms.product_id = p.product_id
    LEFT JOIN marketplaces m ON m.marketplace_id = ms.marketplace_id
    ORDER BY p.product_id DESC, ms.marketplace_id ASC
  `);

  const optionsByProduct = new Map<number, { id: number; name: string; sku?: string; active_channels: string[] }>();

  for (const row of rows) {
    const current = optionsByProduct.get(row.id) ?? {
      id: row.id,
      name: row.name,
      sku: row.sku ?? undefined,
      active_channels: [],
    };
    const normalizedChannel = normalizeChannelSlug(row.marketplace_slug);
    if (normalizedChannel && !current.active_channels.includes(normalizedChannel)) {
      current.active_channels.push(normalizedChannel);
    }
    optionsByProduct.set(row.id, current);
  }

  return Array.from(optionsByProduct.values());
}

export function getMarketplaces() {
  return query<RawMarketplaceRow>("SELECT marketplace_id AS id, name, COALESCE(slug, '') AS slug FROM marketplaces");
}

export function getCategories() {
  return query('SELECT * FROM categories');
}

export function getMarketplaceCategories() {
  return query('SELECT category_id, parent_id, name, level, path FROM categories ORDER BY level, name');
}

export function getShippingCompanies() {
  return query('SELECT * FROM shipping_companies');
}

/**
 * Returns the contracted shipping companies for a specific marketplace.
 * Joins marketplace_shipping_options with shipping_companies.
 */
export function getCarriersByMarketplace(marketplaceName: string) {
  return query<{ shipping_company_id: number; name: string }>(
    `SELECT sc.shipping_company_id, sc.name
     FROM marketplace_shipping_options mso
     JOIN shipping_companies sc ON sc.shipping_company_id = mso.shipping_company_id
     JOIN marketplaces m ON m.marketplace_id = mso.marketplace_id
     WHERE m.name = ?
     ORDER BY sc.name`,
    [marketplaceName]
  );
}

export function getShippingRates() {
  return query('SELECT * FROM shipping_rate_rules');
}

/**
 * Returns the cheapest carrier for a given marketplace and desi value.
 * Looks up the shipping_rate_rules table for exact desi match.
 */
export function getCheapestCarrierForDesi(marketplaceName: string, desi: number) {
  const roundedDesi = Math.max(0, Math.ceil(desi));
  
  const result = getOne<{ company_name: string; price: number }>(
    `SELECT sc.name AS company_name, srr.price
     FROM shipping_rate_rules srr
     JOIN shipping_companies sc ON sc.shipping_company_id = srr.shipping_company_id
     JOIN marketplaces m ON m.marketplace_id = srr.marketplace_id
     WHERE m.name = ? AND srr.desi_min <= ? AND srr.desi_max >= ?
     ORDER BY srr.price ASC
     LIMIT 1`,
    [marketplaceName, roundedDesi, roundedDesi]
  );

  return result ?? null;
}

export function getCommissionRules() {
  return query('SELECT * FROM commission_rules');
}

export function getPlatformFeeRules() {
  return query('SELECT * FROM platform_fee_rules');
}

export function getPaymentGatewayRules() {
  return query('SELECT * FROM payment_gateway_rules');
}

export function getSellerProfiles() {
  return query('SELECT * FROM seller_profiles');
}

export function getProducts() {
  const rows = query<RawProductRow>(`
    SELECT
      p.product_id AS id,
      p.name,
      p.sku,
      p.barcode,
      p.image_url,
      p.category_id,
      p.profile_id,
      c.name AS category_name,
      COALESCE(p.category_path, c.path) AS category_path,
      p.description,
      p.cost,
      p.packaging_cost,
      p.desi,
      p.status,
      p.updated_at,
      (
        SELECT MAX(cr.profit_margin_percent)
        FROM cost_results cr
        WHERE cr.product_id = p.product_id
      ) AS profit_margin_percent,
      (
        SELECT COALESCE(SUM(id.stock_qty - COALESCE(id.reserved_qty, 0)), 0)
        FROM inventory_daily id
        WHERE id.product_id = p.product_id
          AND id.inventory_date = (
            SELECT MAX(id2.inventory_date)
            FROM inventory_daily id2
            WHERE id2.product_id = p.product_id
          )
      ) AS stock_qty
    FROM products p
    LEFT JOIN categories c ON c.category_id = p.category_id
    ORDER BY p.product_id DESC
  `);

  if (rows.length === 0) {
    return [];
  }

  const settingsRows = query<ProductMarketplaceSettingRow>(`
    SELECT
      ms.product_id,
      ms.sale_price,
      ms.shipping_mode,
      m.slug AS marketplace_slug,
      m.name AS marketplace_name
    FROM product_marketplace_settings ms
    LEFT JOIN marketplaces m ON m.marketplace_id = ms.marketplace_id
    ORDER BY ms.product_id, ms.marketplace_id
  `);

  const settingsByProduct = new Map<number, ProductMarketplaceSettingRow[]>();
  for (const row of settingsRows) {
    const current = settingsByProduct.get(row.product_id) ?? [];
    current.push(row);
    settingsByProduct.set(row.product_id, current);
  }

  return rows.map((row): Product => toProduct(row, settingsByProduct.get(row.id) ?? []));
}

export function getProductById(productId: number) {
  return getOne<RawProductRow>(`
    SELECT
      p.product_id AS id,
      p.name,
      p.sku,
      p.barcode,
      p.image_url,
      p.category_id,
      p.profile_id,
      c.name AS category_name,
      COALESCE(p.category_path, c.path) AS category_path,
      p.description,
      p.cost,
      p.packaging_cost,
      p.desi,
      p.status,
      (
        SELECT COALESCE(SUM(id.stock_qty - COALESCE(id.reserved_qty, 0)), 0)
        FROM inventory_daily id
        WHERE id.product_id = p.product_id
          AND id.inventory_date = (
            SELECT MAX(id2.inventory_date)
            FROM inventory_daily id2
            WHERE id2.product_id = p.product_id
          )
      ) AS stock_qty
    FROM products p
    LEFT JOIN categories c ON c.category_id = p.category_id
    WHERE p.product_id = ?
    LIMIT 1
  `, [productId]);
}

export function getProductSnapshot(productId: number) {
  const row = getProductById(productId);
  if (!row) {
    return null;
  }

  const productSettings = query<ProductMarketplaceSettingRow>(`
    SELECT
      ms.product_id,
      ms.sale_price,
      ms.shipping_mode,
      m.slug AS marketplace_slug,
      m.name AS marketplace_name
    FROM product_marketplace_settings ms
    LEFT JOIN marketplaces m ON m.marketplace_id = ms.marketplace_id
    WHERE ms.product_id = ?
    ORDER BY ms.marketplace_id ASC
  `, [productId]);

  return toProduct(row, productSettings);
}

export function getDefaultProductId() {
  const product = getOne<{ product_id: number }>('SELECT product_id FROM products ORDER BY product_id ASC LIMIT 1');
  return product?.product_id ?? null;
}

export function getStoreExpenses(profileId = 1) {
  return query<StoreExpenseRow>(`
    SELECT
      expense_id,
      profile_id,
      name,
      monthly_amount,
      note,
      status
    FROM store_expenses
    WHERE profile_id = ?
    ORDER BY expense_id ASC
  `, [profileId]);
}

export function getStoreExpenseMonthlyTotal(profileId = 1) {
  const groupedAssumptions = getOne<{
    monthly_fixed_expenses: number | null;
    marketplace_expenses: number | null;
    operational_costs: number | null;
  }>(`
    SELECT
      monthly_fixed_expenses,
      marketplace_expenses,
      operational_costs
    FROM seller_profiles
    WHERE profile_id = ?
    LIMIT 1
  `, [profileId]);

  if (
    groupedAssumptions &&
    (
      groupedAssumptions.monthly_fixed_expenses !== null ||
      groupedAssumptions.marketplace_expenses !== null ||
      groupedAssumptions.operational_costs !== null
    )
  ) {
    return Number(
      (
        Number(groupedAssumptions.monthly_fixed_expenses ?? 0) +
        Number(groupedAssumptions.marketplace_expenses ?? 0) +
        Number(groupedAssumptions.operational_costs ?? 0)
      ).toFixed(2)
    );
  }

  const row = getOne<{ total: number | null }>(`
    SELECT SUM(monthly_amount) AS total
    FROM store_expenses
    WHERE profile_id = ? AND COALESCE(status, 'active') = 'active'
  `, [profileId]);
  return Number(row?.total ?? 0);
}

export function getStoreExpenseById(expenseId: number) {
  return getOne<StoreExpenseRow>(`
    SELECT
      expense_id,
      profile_id,
      name,
      monthly_amount,
      note,
      status
    FROM store_expenses
    WHERE expense_id = ?
    LIMIT 1
  `, [expenseId]);
}

export function getSellerProfileById(profileId = 1) {
  return getOne<Record<string, unknown>>('SELECT * FROM seller_profiles WHERE profile_id = ? LIMIT 1', [profileId]);
}

export function getOwnWebsiteGatewayRule() {
  return getOne<{
    id: number;
    seller_profile_id: number | null;
    marketplace_id: number;
    gateway_name: string;
    fee_rate_percent: number | null;
    fixed_fee_per_order: number | null;
    vat_rate_percent: number | null;
    fee_values_include_vat: number | null;
    manual_shipping_cost: number | null;
    avg_ad_cost: number | null;
    avg_conversion_rate: number | null;
    is_active: number | null;
  }>(`
    SELECT
      pgr.*,
      m.name AS marketplace_name,
      m.slug AS marketplace_slug
    FROM payment_gateway_rules pgr
    LEFT JOIN marketplaces m ON m.marketplace_id = pgr.marketplace_id
    WHERE m.slug = 'own_website'
    ORDER BY pgr.id ASC
    LIMIT 1
  `);
}

export function getProductMarketplaceSettings(productId: number) {
  return query('SELECT * FROM product_marketplace_settings WHERE product_id = ?', [productId]);
}

export function getDatabaseCounts() {
  const tables = [
    'categories',
    'marketplaces',
    'shipping_companies',
    'products',
    'price_optimization_runs',
    'store_expenses',
    'seller_profiles',
    'commission_rules',
    'shipping_rate_rules',
    'platform_fee_rules',
    'category_tax_rules',
    'payment_gateway_rules',
    'income_tax_brackets',
    'data_center_sync_runs',
  ];
  const counts: Record<string, number | null> = {};
  
  for (const table of tables) {
    const result = getOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`);
    counts[table] = result ? result.count : null;
  }
  
  return counts;
}

export function getCategoryByPath(path: string) {
  return getOne('SELECT * FROM categories WHERE path = ?', [path]);
}

export function getMarketplaceBySlug(slug: string) {
  return getOne<Marketplace>('SELECT marketplace_id AS id, name, slug FROM marketplaces WHERE slug = ?', [slug]);
}

export function getMarketplaceById(marketplaceId: number) {
  return getOne<Marketplace>('SELECT marketplace_id AS id, name, slug FROM marketplaces WHERE marketplace_id = ? LIMIT 1', [marketplaceId]);
}

export function getProductMarketplaceSetting(productId: number, marketplaceId: number) {
  return getOne<{
    setting_id: number;
    product_id: number;
    marketplace_id: number;
    shipping_company_id: number | null;
    sale_price: number | null;
    buybox_price: number | null;
    manual_shipping_cost: number | null;
    payment_gateway_rule_id: number | null;
    shipping_mode: string | null;
    traffic_cpa: number | null;
    marketplace_name?: string | null;
    marketplace_slug?: string | null;
  }>(`
    SELECT
      ms.setting_id,
      ms.product_id,
      ms.marketplace_id,
      ms.shipping_company_id,
      ms.sale_price,
      ms.buybox_price,
      ms.manual_shipping_cost,
      ms.payment_gateway_rule_id,
      ms.shipping_mode,
      ms.traffic_cpa,
      m.name AS marketplace_name,
      m.slug AS marketplace_slug
    FROM product_marketplace_settings ms
    LEFT JOIN marketplaces m ON m.marketplace_id = ms.marketplace_id
    WHERE ms.product_id = ? AND ms.marketplace_id = ?
    LIMIT 1
  `, [productId, marketplaceId]);
}

export function getPlatformFeeRulesByMarketplaceId(marketplaceId: number) {
  return query(`
    SELECT *
    FROM platform_fee_rules
    WHERE marketplace_id = ? AND COALESCE(is_active, 1) = 1
    ORDER BY id ASC
  `, [marketplaceId]);
}

export function getPaymentGatewayRuleById(ruleId: number) {
  return getOne<{
    id: number;
    seller_profile_id: number | null;
    marketplace_id: number;
    gateway_name: string;
    fee_rate_percent: number | null;
    fixed_fee_per_order: number | null;
    vat_rate_percent: number | null;
    fee_values_include_vat: number | null;
    manual_shipping_cost: number | null;
    avg_ad_cost: number | null;
    avg_conversion_rate: number | null;
    is_active: number | null;
  }>('SELECT * FROM payment_gateway_rules WHERE id = ? LIMIT 1', [ruleId]);
}

// Tariff Readers

export function getCommissionTariffsByMarketplace(marketplaceName: string) {
  const m = getOne<{ marketplace_id: number }>('SELECT marketplace_id FROM marketplaces WHERE name = ?', [marketplaceName]);
  if (!m) return [];

  return query(`
    SELECT 
      cr.*, 
      c.name as category_name, 
      c.path as category_path,
      c.level as category_level
    FROM commission_rules cr
    LEFT JOIN categories c ON c.category_id = cr.category_id
    WHERE cr.marketplace_id = ?
    ORDER BY c.path ASC
  `, [m.marketplace_id]);
}

export function getCommissionTariffSummaryByMarketplace(marketplaceName: string) {
  const tariffs = getCommissionTariffsByMarketplace(marketplaceName) as Array<{
    category_name: string | null;
    category_path: string | null;
    raw_category_name?: string | null;
    commission_rate_percent: number | null;
  }>;

  const summary = new Map<string, { main_category_name: string; min_commission_rate_percent: number; max_commission_rate_percent: number; rule_count: number }>();

  for (const row of tariffs) {
    const categoryLabel = String(row.category_path ?? row.raw_category_name ?? row.category_name ?? "Diğer");
    const mainCategoryName = categoryLabel.split(" > ")[0]?.trim() || "Diğer";
    const rate = Number(row.commission_rate_percent ?? 0);
    const current = summary.get(mainCategoryName);
    if (!current) {
      summary.set(mainCategoryName, {
        main_category_name: mainCategoryName,
        min_commission_rate_percent: rate,
        max_commission_rate_percent: rate,
        rule_count: 1,
      });
      continue;
    }

    current.min_commission_rate_percent = Math.min(current.min_commission_rate_percent, rate);
    current.max_commission_rate_percent = Math.max(current.max_commission_rate_percent, rate);
    current.rule_count += 1;
  }

  return Array.from(summary.values()).sort((left, right) => left.main_category_name.localeCompare(right.main_category_name, "tr"));
}

export function getCommissionForCategory(marketplaceName: string, categoryId: number) {
  const m = getOne<{ marketplace_id: number }>('SELECT marketplace_id FROM marketplaces WHERE name = ?', [marketplaceName]);
  if (!m) return null;

  const targetCategory = getOne<{ name: string, path: string }>('SELECT name, path FROM categories WHERE category_id = ?', [categoryId]);
  const selectedCategoryPath = targetCategory?.path || targetCategory?.name || "Bilinmeyen Kategori";

  // 1. Direct match
  let rule = getOne<any>(`
    SELECT cr.*, c.path as category_path, c.name as category_name
    FROM commission_rules cr
    JOIN categories c ON c.category_id = cr.category_id
    WHERE cr.marketplace_id = ? AND cr.category_id = ?
  `, [m.marketplace_id, categoryId]);

  if (rule) {
    return {
      marketplace: marketplaceName,
      selectedCategory: selectedCategoryPath,
      matchedCategory: rule.category_path || rule.category_name,
      commissionRate: rule.commission_rate_percent,
      matchType: 'direct',
      warning: null
    };
  }

  // 2. Parent fallback
  let currentCategoryId = categoryId;
  while (true) {
    const cat = getOne<{ parent_id: number }>('SELECT parent_id FROM categories WHERE category_id = ?', [currentCategoryId]);
    if (!cat || !cat.parent_id) break;

    currentCategoryId = cat.parent_id;
    rule = getOne<any>(`
      SELECT cr.*, c.path as category_path, c.name as category_name
      FROM commission_rules cr
      JOIN categories c ON c.category_id = cr.category_id
      WHERE cr.marketplace_id = ? AND cr.category_id = ?
    `, [m.marketplace_id, currentCategoryId]);

    if (rule) {
      return {
        marketplace: marketplaceName,
        selectedCategory: selectedCategoryPath,
        matchedCategory: rule.category_path || rule.category_name,
        commissionRate: rule.commission_rate_percent,
        matchType: 'parent_fallback',
        warning: 'Bu kategori için birebir komisyon kuralı bulunamadı. En yakın üst kategori kuralı kullanılıyor.'
      };
    }
  }

  // 3. Global fallback
  rule = getOne<any>(`
    SELECT cr.*
    FROM commission_rules cr
    WHERE cr.marketplace_id = ?
    LIMIT 1
  `, [m.marketplace_id]);

  if (rule) {
    return {
      marketplace: marketplaceName,
      selectedCategory: selectedCategoryPath,
      matchedCategory: 'Genel Pazar Yeri Kuralı',
      commissionRate: rule.commission_rate_percent,
      matchType: 'global_fallback',
      warning: 'Bu kategori veya üst kategorileri için komisyon kuralı bulunamadı. Genel pazar yeri kuralı kullanılıyor.'
    };
  }

  return null;
}

export function getShippingTariffMatrix(marketplaceName: string) {
  const m = getOne<{ marketplace_id: number }>('SELECT marketplace_id FROM marketplaces WHERE name = ?', [marketplaceName]);
  if (!m) return null;

  const companies = query<{ shipping_company_id: number, name: string }>(`
    SELECT DISTINCT sc.shipping_company_id, sc.name
    FROM shipping_companies sc
    JOIN shipping_rate_rules srr ON srr.shipping_company_id = sc.shipping_company_id
    WHERE srr.marketplace_id = ?
  `, [m.marketplace_id]);

  const rules = query<any>(`
    SELECT * FROM shipping_rate_rules 
    WHERE marketplace_id = ?
    ORDER BY desi_min ASC
  `, [m.marketplace_id]);

  // Group by desi
  const desiMap = new Map<number, any>();
  rules.forEach((r: any) => {
    const desi = r.desi_min; // Assuming desi_min is the key for "Desi X"
    if (!desiMap.has(desi)) {
      desiMap.set(desi, { desi, prices: {} });
    }
    const company = companies.find(c => c.shipping_company_id === r.shipping_company_id);
    if (company) {
      desiMap.get(desi).prices[company.name] = r.price;
    }
  });

  return {
    marketplace: marketplaceName,
    carriers: companies.map(c => c.name),
    rows: Array.from(desiMap.values()).sort((a, b) => a.desi - b.desi)
  };
}
