import { saveProductRecord } from "@/app/api/products/service";

import { getDb } from "./db";
import { generateDemoSalesHistory } from "./demo-sales-history";
import { DEMO_PRODUCT_SEEDS, deriveDemoSalePrice } from "./demo-product-seeds";
import {
  buildSeedDemoSuccessMessage,
  SEED_DEMO_WARNING_MESSAGE,
  type SeedDemoResponse,
} from "./seed-demo-contract";

type Database = NonNullable<ReturnType<typeof getDb>>;

type ProductRow = {
  product_id: number;
};

type MarketplaceRow = {
  marketplace_id: number;
};

async function getCategoryId(db: Database, path: string, fallbackId: number) {
  const row = await db
    .prepare("SELECT category_id FROM categories WHERE path = ? LIMIT 1")
    .get(path) as { category_id: number } | undefined;
  return row?.category_id ?? fallbackId;
}

async function getMarketplaceId(db: Database, slug: string, fallbackId: number) {
  const row = await db
    .prepare("SELECT marketplace_id FROM marketplaces WHERE slug = ? LIMIT 1")
    .get(slug) as MarketplaceRow | undefined;
  return row?.marketplace_id ?? fallbackId;
}

async function getOrCreateGatewayId(db: Database, marketplaceId: number) {
  const existing = await db
    .prepare(
      "SELECT id FROM payment_gateway_rules WHERE marketplace_id = ? AND gateway_name = ? LIMIT 1"
    )
    .get(marketplaceId, "Kullanici Tanimli Odeme Altyapisi") as { id: number } | undefined;

  if (existing) {
    return existing.id;
  }

  const result = await db
    .prepare(
      "INSERT INTO payment_gateway_rules (seller_profile_id, marketplace_id, gateway_name, fee_rate_percent, fixed_fee_per_order, vat_rate_percent, fee_values_include_vat, is_active) VALUES (1, ?, 'Kullanici Tanimli Odeme Altyapisi', 3.49, 0.25, 20, 1, 1)"
    )
    .run(marketplaceId);

  return Number(result.lastInsertRowid);
}

export async function ensureDemoData(): Promise<SeedDemoResponse> {
  const db = getDb();

  if (!db) {
    return {
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: "Database baglantisi kurulamadi. Demo veriler UI tarafinda gosterilecek.",
      warning: SEED_DEMO_WARNING_MESSAGE,
    };
  }

  try {
    const ownWebsiteId = await getMarketplaceId(db, "own_website", 3);
    await getOrCreateGatewayId(db, ownWebsiteId);

    const ensureSellerProfile = db.prepare(
      "INSERT INTO seller_profiles (profile_id, company_type, monthly_employee_cost, monthly_warehouse_cost, monthly_invoice_accounting_cost, monthly_other_expenses, expected_monthly_order_count) VALUES (1, 'Sahis Sirketi', 0, 3000, 1000, 1000, 500) ON CONFLICT(profile_id) DO NOTHING"
    );

    await db.transaction(async () => {
      const tableExists = async (name: string) =>
        await db.prepare("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' AND tablename=?").get(name);

      if (await tableExists("price_optimization_runs")) await db.prepare("DELETE FROM price_optimization_runs").run();
      if (await tableExists("order_items")) await db.prepare("DELETE FROM order_items").run();
      if (await tableExists("orders")) await db.prepare("DELETE FROM orders").run();
      if (await tableExists("inventory_daily")) await db.prepare("DELETE FROM inventory_daily").run();
      if (await tableExists("demand_forecasts")) await db.prepare("DELETE FROM demand_forecasts").run();
      if (await tableExists("seo_generations")) await db.prepare("DELETE FROM seo_generations").run();
      await db.prepare("DELETE FROM cost_results").run();
      await db.prepare("DELETE FROM product_marketplace_settings").run();
      await db.prepare("DELETE FROM products").run();
    });

    const findProduct = db.prepare("SELECT product_id FROM products WHERE name = ? LIMIT 1");

    let productsInserted = 0;
    let productsSkipped = 0;

    await ensureSellerProfile.run();

    for (const product of DEMO_PRODUCT_SEEDS) {
      const categoryId = await getCategoryId(db, product.categoryPath, product.fallbackCategoryId);
      const existing = await findProduct.get(product.name) as ProductRow | undefined;

      await saveProductRecord(
        {
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
        },
        existing?.product_id
      );

      if (existing) {
        productsSkipped++;
      } else {
        productsInserted++;
      }
    }

    const salesSummary = await generateDemoSalesHistory(db, { days: 90, resetSalesTables: false });
    const successSummary =
      `Eski urunler silindi, ${productsInserted} yeni demo urun ve ` +
      `son 90 gune ait ${salesSummary.ordersInserted} demo siparis eklendi.`;

    return {
      success: true,
      productsInserted,
      productsSkipped,
      settingsInserted: DEMO_PRODUCT_SEEDS.length * 3,
      ordersInserted: salesSummary.ordersInserted,
      orderItemsInserted: salesSummary.orderItemsInserted,
      inventoryRowsInserted: salesSummary.inventoryRowsInserted,
      message: buildSeedDemoSuccessMessage(successSummary),
      warning: SEED_DEMO_WARNING_MESSAGE,
    };
  } catch (error) {
    console.error("Seed error:", error);
    const message = error instanceof Error ? error.message : "Bilinmeyen hata";
    return {
      success: false,
      productsInserted: 0,
      productsSkipped: 0,
      settingsInserted: 0,
      message: `Veritabani hatasi: ${message}`,
      warning: SEED_DEMO_WARNING_MESSAGE,
    };
  }
}
