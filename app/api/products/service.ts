import { getDb, getOne } from "@/lib/db";
import { getMarketplaceBySlug, getOwnWebsiteGatewayRule } from "@/lib/database-readers";
import type { ProductUpsertInput } from "@/lib/types";

const ALLOWED_CHANNELS = new Set(["trendyol", "hepsiburada", "my_website"]);

function normalizeChannels(channels: string[]) {
  return Array.from(
    new Set(
      channels
        .map((channel) => {
          if (channel === "own_website" || channel === "own-website" || channel === "website") {
            return "my_website";
          }
          return channel;
        })
        .filter((channel) => ALLOWED_CHANNELS.has(channel))
    )
  );
}

async function getDefaultMarketplaceShippingCompanyId(marketplaceId: number) {
  const row = await getOne<{ shipping_company_id: number }>(
    "SELECT shipping_company_id FROM marketplace_shipping_options WHERE marketplace_id = ? ORDER BY shipping_company_id ASC LIMIT 1",
    [marketplaceId]
  );
  return row?.shipping_company_id ?? null;
}

async function persistProductSettings(db: NonNullable<ReturnType<typeof getDb>>, productId: number, payload: ProductUpsertInput) {
  const channels = normalizeChannels(payload.active_channels);
  const gatewayRule = await getOwnWebsiteGatewayRule();
  const existingSettings = await db
    .prepare(
      `
        SELECT
          marketplace_id,
          shipping_company_id,
          manual_shipping_cost,
          payment_gateway_rule_id,
          shipping_mode,
          traffic_cpa,
          buybox_price
        FROM product_marketplace_settings
        WHERE product_id = ?
      `
    )
    .all(productId) as Array<{
    marketplace_id: number;
    shipping_company_id: number | null;
    manual_shipping_cost: number | null;
    payment_gateway_rule_id: number | null;
    shipping_mode: string | null;
    traffic_cpa: number | null;
    buybox_price: number | null;
  }>;
  const settingsByMarketplaceId = new Map(
    existingSettings.map((setting) => [setting.marketplace_id, setting] as const)
  );
  const insertSetting = db.prepare(`
    INSERT INTO product_marketplace_settings (
      product_id,
      marketplace_id,
      shipping_company_id,
      sale_price,
      buybox_price,
      manual_shipping_cost,
      payment_gateway_rule_id,
      shipping_mode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await db.prepare("DELETE FROM product_marketplace_settings WHERE product_id = ?").run(productId);

  for (const channel of channels) {
    const marketplaceSlug = channel === "my_website" ? "own_website" : channel;
    const marketplace = await getMarketplaceBySlug(marketplaceSlug);
    if (!marketplace) continue;

    const isOwnWebsite = marketplaceSlug === "own_website";
    const existingSetting = settingsByMarketplaceId.get(marketplace.id);
    await insertSetting.run(
      productId,
      marketplace.id,
      isOwnWebsite
        ? null
        : existingSetting?.shipping_company_id ?? await getDefaultMarketplaceShippingCompanyId(marketplace.id),
      payload.sale_price,
      existingSetting?.buybox_price ?? null,
      isOwnWebsite
        ? Number(existingSetting?.manual_shipping_cost ?? gatewayRule?.manual_shipping_cost ?? 95)
        : existingSetting?.manual_shipping_cost ?? null,
      isOwnWebsite
        ? existingSetting?.payment_gateway_rule_id ?? gatewayRule?.id ?? null
        : existingSetting?.payment_gateway_rule_id ?? null,
      isOwnWebsite
        ? existingSetting?.shipping_mode ?? "manual"
        : existingSetting?.shipping_mode ?? "marketplace_rate"
    );
  }
}

export async function saveProductRecord(payload: ProductUpsertInput, productId?: number) {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection unavailable");
  }

  const channels = normalizeChannels(payload.active_channels);
  if (channels.length === 0) {
    throw new Error("At least one sales channel must be selected");
  }

  const resolvedProductId = productId ?? null;
  if (resolvedProductId) {
    const existingProduct = await getOne<{ product_id: number }>("SELECT product_id FROM products WHERE product_id = ? LIMIT 1", [resolvedProductId]);
    if (!existingProduct) {
      throw new Error("Product not found");
    }
  }

  const existingProfileId = resolvedProductId
    ? (await getOne<{ profile_id: number | null }>("SELECT profile_id FROM products WHERE product_id = ? LIMIT 1", [resolvedProductId]))?.profile_id ?? 1
    : 1;

  const insertProduct = db.prepare(`
    INSERT INTO products (name, sku, barcode, image_url, category_id, category_path, description, profile_id, cost, packaging_cost, desi, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateProduct = db.prepare(`
    UPDATE products
    SET name = ?, sku = ?, barcode = ?, image_url = ?, category_id = ?, category_path = ?, description = ?, profile_id = ?, cost = ?, packaging_cost = ?, desi = ?, status = ?
    WHERE product_id = ?
  `);

  let nextProductId = resolvedProductId;
  await db.transaction(async () => {
    if (resolvedProductId) {
      await updateProduct.run(
        payload.name,
        payload.sku ?? null,
        payload.barcode ?? payload.sku ?? null,
        payload.image_url ?? null,
        payload.category_id,
        payload.category_path,
        payload.description ?? null,
        existingProfileId,
        payload.cost,
        payload.packaging_cost,
        payload.desi,
        payload.status,
        resolvedProductId
      );
    } else {
      const result = await insertProduct.run(
        payload.name,
        payload.sku ?? null,
        payload.barcode ?? payload.sku ?? null,
        payload.image_url ?? null,
        payload.category_id,
        payload.category_path,
        payload.description ?? null,
        existingProfileId,
        payload.cost,
        payload.packaging_cost,
        payload.desi,
        payload.status
      );
      nextProductId = Number(result.lastInsertRowid);
    }

    if (!nextProductId) {
      throw new Error("Product id could not be resolved");
    }

    await persistProductSettings(db, nextProductId, payload);
  });

  return nextProductId as number;
}

export async function deleteProductRecord(productId: number) {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection unavailable");
  }

  await db.transaction(async () => {
    await db.prepare("DELETE FROM price_optimization_runs WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM demand_forecasts WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM inventory_daily WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM order_items WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM orders WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM cost_results WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM product_marketplace_settings WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM seo_generations WHERE product_id = ?").run(productId);
    await db.prepare("DELETE FROM products WHERE product_id = ?").run(productId);
  });
}
