import { getDb } from "./db";
import { DEMO_PRODUCT_SEEDS, deriveDemoSalePrice } from "./demo-product-seeds";
import { generateDemoSalesHistory } from "./demo-sales-history";
import { saveProductRecord } from "@/app/api/products/service";

type Database = NonNullable<ReturnType<typeof getDb>>;

type ProductRow = {
  product_id: number;
};

type MarketplaceRow = {
  marketplace_id: number;
};

function getCategoryId(db: Database, path: string, fallbackId: number) {
  const row = db
    .prepare("SELECT category_id FROM categories WHERE path = ? LIMIT 1")
    .get(path) as { category_id: number } | undefined;
  return row?.category_id ?? fallbackId;
}

function getMarketplaceId(db: Database, slug: string, fallbackId: number) {
  const row = db
    .prepare("SELECT marketplace_id FROM marketplaces WHERE slug = ? LIMIT 1")
    .get(slug) as MarketplaceRow | undefined;
  return row?.marketplace_id ?? fallbackId;
}

function getOrCreateGatewayId(db: Database, marketplaceId: number) {
  const existing = db
    .prepare(
      "SELECT id FROM payment_gateway_rules WHERE marketplace_id = ? AND gateway_name = ? LIMIT 1"
    )
    .get(marketplaceId, "Kullanıcı Tanımlı Ödeme Altyapısı") as { id: number } | undefined;

  if (existing) {
    return existing.id;
  }

  const result = db
    .prepare(
      "INSERT INTO payment_gateway_rules (seller_profile_id, marketplace_id, gateway_name, fee_rate_percent, fixed_fee_per_order, vat_rate_percent, fee_values_include_vat, is_active) VALUES (1, ?, 'Kullanıcı Tanımlı Ödeme Altyapısı', 3.49, 0.25, 20, 1, 1)"
    )
    .run(marketplaceId);

  return Number(result.lastInsertRowid);
}

/**
 * Removes all existing products and related data from the database,
 * then re-seeds with the current DEMO_PRODUCT_SEEDS.
 */
export async function ensureDemoData() {
  const db = getDb();

  if (!db) {
    return {
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: "Database bağlantısı kurulamadı. Demo veriler UI tarafında gösterilecek.",
    };
  }

  try {
    const ownWebsiteId = getMarketplaceId(db, "own_website", 3);
    getOrCreateGatewayId(db, ownWebsiteId);

    const ensureSellerProfile = db.prepare(
      "INSERT OR IGNORE INTO seller_profiles (profile_id, company_type, monthly_employee_cost, monthly_warehouse_cost, monthly_invoice_accounting_cost, monthly_other_expenses, expected_monthly_order_count) VALUES (1, 'Şahıs Şirketi', 0, 3000, 1000, 1000, 500)"
    );

    // ── Step 1: Delete ALL existing products and related data ──
    db.transaction(() => {
      const tableExists = (name: string) =>
        db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

      if (tableExists("price_optimization_runs")) db.prepare("DELETE FROM price_optimization_runs").run();
      if (tableExists("order_items")) db.prepare("DELETE FROM order_items").run();
      if (tableExists("orders")) db.prepare("DELETE FROM orders").run();
      if (tableExists("inventory_daily")) db.prepare("DELETE FROM inventory_daily").run();
      if (tableExists("demand_forecasts")) db.prepare("DELETE FROM demand_forecasts").run();
      if (tableExists("seo_generations")) db.prepare("DELETE FROM seo_generations").run();
      db.prepare("DELETE FROM cost_results").run();
      db.prepare("DELETE FROM product_marketplace_settings").run();
      db.prepare("DELETE FROM products").run();
    })();

    const findProduct = db.prepare("SELECT product_id FROM products WHERE name = ? LIMIT 1");

    let productsInserted = 0;
    let productsSkipped = 0;

    ensureSellerProfile.run();

    // ── Step 2: Insert fresh demo products ──
    for (const product of DEMO_PRODUCT_SEEDS) {
      const categoryId = getCategoryId(db, product.categoryPath, product.fallbackCategoryId);
      const existing = findProduct.get(product.name) as ProductRow | undefined;

      saveProductRecord({
        name: product.name,
        sku: product.sku,
        image_url: product.imageUrl,
        category_id: categoryId,
        category_path: product.categoryPath,
        cost: product.cost,
        packaging_cost: product.packagingCost,
        desi: product.desi,
        sale_price: deriveDemoSalePrice(product.cost, product.packagingCost),
        active_channels: product.activeChannels,
        status: product.status,
      }, existing?.product_id);

      if (existing) {
        productsSkipped++;
      } else {
        productsInserted++;
      }
    }

    const salesSummary = generateDemoSalesHistory(db, { days: 90, resetSalesTables: false });

    return {
      success: true,
      productsInserted,
      productsSkipped,
      settingsInserted: DEMO_PRODUCT_SEEDS.length * 3,
      ordersInserted: salesSummary.ordersInserted,
      orderItemsInserted: salesSummary.orderItemsInserted,
      inventoryRowsInserted: salesSummary.inventoryRowsInserted,
      message: `Eski ürünler silindi, ${productsInserted} yeni demo ürün ve son 90 güne ait ${salesSummary.ordersInserted} demo sipariş eklendi.`,
    };
  } catch (error) {
    console.error("Seed error:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return {
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: "Veritabanı hatası: " + message,
    };
  }
}
