import { getDb } from "./db";
import { getCampaignPlatformConfig, resolveCampaignPlatformFromProduct } from "./ad-analysis";

type Database = NonNullable<ReturnType<typeof getDb>>;

type DemoSalesChannelRow = {
  product_id: number;
  product_name: string;
  sku: string | null;
  barcode: string | null;
  cost: number;
  packaging_cost: number;
  desi: number;
  sale_price: number;
  marketplace_id: number;
  marketplace_slug: string | null;
  marketplace_name: string;
  channel_sale_price: number | null;
};

export type DemoSalesGenerationOptions = {
  days?: number;
  resetSalesTables?: boolean;
  startDate?: Date;
};

export type DemoSalesGenerationSummary = {
  days: number;
  products: number;
  marketplaces: number;
  ordersInserted: number;
  orderItemsInserted: number;
  inventoryRowsInserted: number;
  startDate: string;
  endDate: string;
};

const WEEKDAY_WEIGHTS = [0.82, 0.9, 0.98, 1.04, 1.15, 1.28, 1.18];
const BUYER_NAMES = [
  "Deniz Yılmaz",
  "Elif Kaya",
  "Mert Demir",
  "Zeynep Arslan",
  "Kerem Çelik",
  "Ece Aydın",
  "Bora Öztürk",
  "Seda Koç",
  "Barış Yalçın",
  "Nehir Şahin",
  "Tolga Güneş",
  "İrem Kılıç",
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function seededRandom(seed: number) {
  let state = Math.abs(Math.trunc(seed)) % 2147483647;
  if (state === 0) {
    state = 1;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resolveCampaignBias(seed: string) {
  const hash = hashText(seed);
  return 0.84 + (hash % 33) / 100;
}

function normalizeSlug(slug: string | null) {
  if (!slug) return null;
  if (slug === "own_website" || slug === "own-website" || slug === "website") {
    return "own_website";
  }
  return slug;
}

function pickWeighted<T>(items: T[], weights: number[], rand: () => number) {
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (items.length === 0) return null;
  if (totalWeight <= 0) return items[0];

  let cursor = rand() * totalWeight;
  for (let index = 0; index < items.length; index += 1) {
    cursor -= Math.max(0, weights[index] ?? 0);
    if (cursor <= 0) {
      return items[index];
    }
  }

  return items[items.length - 1];
}

function resolveBaseDailyUnits(row: DemoSalesChannelRow, productIndex: number) {
  const categoryBoost =
    /kulaklık|saat|bileklik|tekno|elektronik/i.test(`${row.product_name} ${row.marketplace_name}`)
      ? 1.12
      : /kolye|takı|aksesuar/i.test(`${row.product_name} ${row.marketplace_name}`)
        ? 0.92
        : 1;

  const priceBand = Math.max(0, Number(row.sale_price ?? 0));
  const costBand = Math.max(0, Number(row.cost ?? 0));
  const base = 4.5 + priceBand / 180 + Math.max(0, 1200 - costBand) / 280 + Number(row.desi ?? 0) * 1.2 + productIndex * 0.35;

  return clamp(Math.round(base * categoryBoost), 3, 24);
}

function resolveTrendSlope(productIndex: number) {
  const slopes = [0.16, 0.08, -0.05, 0.11, 0.18];
  return slopes[productIndex % slopes.length];
}

function resolveSeasonalityPhase(productIndex: number) {
  return (productIndex * 53) % 360 * (Math.PI / 180);
}

function resolveChannelWeights(channels: Array<{ marketplace_slug: string | null }>) {
  const baseWeights = channels.map((channel) => {
    switch (normalizeSlug(channel.marketplace_slug)) {
      case "trendyol":
        return 0.45;
      case "hepsiburada":
        return 0.34;
      case "own_website":
        return 0.21;
      default:
        return 0.18;
    }
  });

  const total = baseWeights.reduce((sum, weight) => sum + weight, 0);
  return total > 0 ? baseWeights.map((weight) => weight / total) : channels.map(() => 1 / Math.max(1, channels.length));
}

function resolveChannelPrice(row: DemoSalesChannelRow, channelSlug: string | null, rand: () => number, dayIndex: number) {
  const basePrice = Number(row.channel_sale_price ?? row.sale_price ?? 0);
  const weekdayBoost = [0.99, 1, 1.01, 1.015, 1.02, 1.03, 1.01][dayIndex % 7];
  const channelPremium = normalizeSlug(channelSlug) === "own_website" ? 1.02 : normalizeSlug(channelSlug) === "trendyol" ? 1.0 : 0.995;
  const noise = 0.985 + rand() * 0.03;
  return round2(basePrice * weekdayBoost * channelPremium * noise);
}

function resolveStatus(rand: () => number) {
  const statuses = ["completed", "completed", "completed", "completed", "processing", "cancelled", "returned"];
  return statuses[Math.min(statuses.length - 1, Math.floor(rand() * statuses.length))];
}

function resolveBuyerName(rand: () => number) {
  return BUYER_NAMES[Math.floor(rand() * BUYER_NAMES.length)] ?? "Demo Alıcı";
}

async function resetSalesTables(db: Database) {
  await db.prepare("DELETE FROM order_items").run();
  await db.prepare("DELETE FROM orders").run();
  await db.prepare("DELETE FROM inventory_daily").run();
}

export async function generateDemoSalesHistory(db: Database, options: DemoSalesGenerationOptions = {}): Promise<DemoSalesGenerationSummary> {
  const days = Math.max(1, Math.trunc(options.days ?? 90));
  const endDate = stripTime(options.startDate ?? new Date());
  const startDate = addDays(endDate, -(days - 1));

  if (options.resetSalesTables) {
    await resetSalesTables(db);
  }

  const rows = await db.prepare(
    `
      SELECT
        p.product_id,
        p.name AS product_name,
        p.sku,
        p.barcode,
        p.cost,
        p.packaging_cost,
        p.desi,
        COALESCE(pms.sale_price, (p.cost * 4.5) + p.packaging_cost) AS sale_price,
        m.marketplace_id,
        m.slug AS marketplace_slug,
        m.name AS marketplace_name,
        pms.sale_price AS channel_sale_price
      FROM products p
      JOIN product_marketplace_settings pms ON pms.product_id = p.product_id
      JOIN marketplaces m ON m.marketplace_id = pms.marketplace_id
      WHERE COALESCE(p.status, 'active') <> 'deleted'
      ORDER BY p.product_id, m.marketplace_id
    `
  ).all() as DemoSalesChannelRow[];

  if (rows.length === 0) {
    return {
      days,
      products: 0,
      marketplaces: 0,
      ordersInserted: 0,
      orderItemsInserted: 0,
      inventoryRowsInserted: 0,
      startDate: toDateKey(startDate),
      endDate: toDateKey(endDate),
    };
  }

  const rowsByProduct = new Map<number, DemoSalesChannelRow[]>();
  for (const row of rows) {
    const list = rowsByProduct.get(row.product_id) ?? [];
    list.push(row);
    rowsByProduct.set(row.product_id, list);
  }

  const counts = await db.transaction(async () => {
    const orderInsert = db.prepare(
      `
        INSERT INTO orders (
          product_id,
          marketplace_id,
          order_date,
          quantity,
          unit_price,
          status,
          external_order_number,
          external_package_number,
          external_line_item_id,
          merchant_sku,
          barcode,
          buyer_name,
          order_status_detail,
          currency_code,
          gross_amount,
          discount_amount,
          shipping_amount,
          commission_amount,
          realized_commission,
          realized_shipping_cost,
          settlement_transaction_type,
          raw_payload_json,
          campaign_id,
          campaign_name,
          utm_source,
          utm_medium,
          utm_campaign,
          platform_reported_revenue,
          platform_reported_roas,
          last_synced_at,
          updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `
    );

    const itemInsert = db.prepare(
      `
        INSERT INTO order_items (
          order_id,
          marketplace_order_number,
          package_number,
          external_order_line_id,
          merchant_sku,
          barcode,
          product_id,
          quantity,
          unit_price,
          line_total,
          commission_amount,
          shipping_cost,
          transaction_type,
          raw_payload_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `
    );

    const inventoryInsert = db.prepare(
      `
        INSERT INTO inventory_daily (
          product_id,
          marketplace_id,
          inventory_date,
          stock_qty,
          reserved_qty
        ) VALUES (?, ?, ?, ?, ?)
      `
    );

    const inventoryState = new Map<string, number>();
    let ordersInserted = 0;
    let orderItemsInserted = 0;
    let inventoryRowsInserted = 0;

    let productIndex = 0;
    for (const [productId, channels] of rowsByProduct.entries()) {
      const trendIndex = productIndex;
      productIndex += 1;

      const productSeed = hashText(`inventory:${productId}`);
      const productRand = seededRandom(productSeed);

      channels.forEach((channel) => {
        const initialBase = resolveBaseDailyUnits(channel, trendIndex);
        const initialStock = clamp(Math.round(initialBase * 10 + productRand() * 40), 60, 320);
        inventoryState.set(`${productId}:${channel.marketplace_id}`, initialStock);
      });

      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const currentDate = addDays(startDate, dayIndex);
        const currentDateKey = toDateKey(currentDate);
        const dayRand = seededRandom(hashText(`${currentDateKey}:${productId}`));
        const channelWeights = resolveChannelWeights(channels);
        const trendSlope = resolveTrendSlope(trendIndex);
        const phase = resolveSeasonalityPhase(trendIndex);
        const baseDailyUnits = resolveBaseDailyUnits(channels[0], trendIndex);

        const weekly = WEEKDAY_WEIGHTS[currentDate.getDay()] ?? 1;
        const monthly = 1 + 0.15 * Math.sin(dayIndex / 11 + phase);
        const trend = 1 + trendSlope * (dayIndex / Math.max(1, days - 1) - 0.45);
        const promoWave = 1 + (dayIndex >= Math.floor(days * 0.7) && dayIndex <= Math.floor(days * 0.84) ? 0.12 : 0);
        const noise = 0.86 + dayRand() * 0.3;
        const targetUnits = Math.max(0, Math.round(baseDailyUnits * weekly * monthly * trend * promoWave * noise));

        let remainingUnits = targetUnits;
        let orderIndex = 0;

        while (remainingUnits > 0) {
          const channel = pickWeighted(channels, channelWeights, dayRand) ?? channels[0];
          const channelSeed = seededRandom(hashText(`${currentDateKey}:${productId}:${channel.marketplace_id}:${orderIndex}`));
          const channelSlug = normalizeSlug(channel.marketplace_slug);
          const quantity = Math.max(1, Math.min(remainingUnits, 1 + Math.floor(channelSeed() * 3)));
          const unitPrice = resolveChannelPrice(channel, channelSlug, channelSeed, dayIndex);
          const status = resolveStatus(channelSeed);
          const commissionRate = channelSlug === "trendyol" ? 0.16 : channelSlug === "hepsiburada" ? 0.14 : 0.035;
          const shippingRate = channelSlug === "own_website" ? 24 : channelSlug === "trendyol" ? 18 : 20;
          const grossAmount = round2(quantity * unitPrice);
          const discountAmount = round2(grossAmount * (0.02 + channelSeed() * 0.06));
          const netAmount = round2(Math.max(0, grossAmount - discountAmount));
          const commissionAmount = round2(netAmount * commissionRate);
          const shippingAmount = round2(shippingRate + channelSeed() * 12 + Number(channel.desi ?? 0) * 1.3);
          const externalOrderNumber = `DEMO-${channel.marketplace_id}-${channel.product_id}-${currentDateKey.replace(/-/g, "")}-${String(orderIndex + 1).padStart(3, "0")}`;
          const externalPackageNumber = `${externalOrderNumber}-PKG`;
          const externalLineItemId = `${externalOrderNumber}-LINE-1`;
          const buyerName = resolveBuyerName(channelSeed);
          const campaignPlatform = channelSlug === "own_website"
            ? resolveCampaignPlatformFromProduct({
              id: channel.product_id,
              name: channel.product_name,
                category_name: undefined,
                category_path: undefined,
              })
            : null;
          const campaignPlatformConfig = campaignPlatform ? getCampaignPlatformConfig(campaignPlatform) : null;
          const campaignBias = campaignPlatform ? resolveCampaignBias(`${channel.product_id}:${campaignPlatform}:${currentDateKey}`) : 0;
          const campaignId = campaignPlatform ? `${campaignPlatform}:${channel.product_id}` : null;
          const campaignName = campaignPlatform ? `${campaignPlatformConfig?.label ?? "Campaign"} · ${channel.product_name}` : null;
          const utmSource = campaignPlatform ?? null;
          const utmMedium = campaignPlatform
            ? campaignPlatform === "google_ads"
              ? "cpc"
              : "paid_social"
            : null;
          const utmCampaign = campaignName;
          const platformReportedRevenue = campaignPlatform ? netAmount : 0;
          const platformReportedRoas = campaignPlatformConfig ? round2(campaignPlatformConfig.roasTarget * campaignBias) : 0;
          const orderStatusDetail =
            status === "completed"
              ? "Teslim edildi"
              : status === "processing"
                ? "Hazırlanıyor"
                : status === "returned"
                  ? "İade edildi"
                  : "İptal edildi";
          const rowBarcode = channel.barcode ?? channel.sku ?? `BAR-${channel.product_id}`;

          const orderResult = await orderInsert.run(
            channel.product_id,
            channel.marketplace_id,
            currentDateKey,
            quantity,
            unitPrice,
            status,
            externalOrderNumber,
            externalPackageNumber,
            externalLineItemId,
            channel.sku ?? rowBarcode,
            rowBarcode,
            buyerName,
            orderStatusDetail,
            "TRY",
            grossAmount,
            discountAmount,
            shippingAmount,
            commissionAmount,
            commissionAmount,
            shippingAmount,
            status,
            JSON.stringify(
              {
                source: "demo-seed",
                product_id: channel.product_id,
                marketplace_id: channel.marketplace_id,
                sku: channel.sku,
                barcode: rowBarcode,
                quantity,
                unit_price: unitPrice,
                status,
              },
              null,
              0
            ),
            campaignId,
            campaignName,
            utmSource,
            utmMedium,
            utmCampaign,
            platformReportedRevenue,
            platformReportedRoas
          );

          const orderId = Number(orderResult.lastInsertRowid);
          await itemInsert.run(
            orderId,
            externalOrderNumber,
            externalPackageNumber,
            externalLineItemId,
            channel.sku ?? rowBarcode,
            rowBarcode,
            channel.product_id,
            quantity,
            unitPrice,
            netAmount,
            commissionAmount,
            shippingAmount,
            status,
            JSON.stringify(
              {
                source: "demo-seed",
                order_number: externalOrderNumber,
                product_id: channel.product_id,
                quantity,
                unit_price: unitPrice,
                line_total: netAmount,
              },
              null,
              0
            )
          );

          ordersInserted += 1;
          orderItemsInserted += 1;
          remainingUnits -= quantity;
          orderIndex += 1;

          const inventoryKey = `${channel.product_id}:${channel.marketplace_id}`;
          const currentStock = inventoryState.get(inventoryKey) ?? 0;
          if (status === "completed" || status === "processing") {
            inventoryState.set(inventoryKey, Math.max(0, currentStock - quantity));
          }
        }

        for (const channel of channels) {
          const inventoryKey = `${channel.product_id}:${channel.marketplace_id}`;
          let stock = inventoryState.get(inventoryKey) ?? 0;
          const replenishmentTrigger = Math.max(10, Math.round(baseDailyUnits * 2));
          if (stock < replenishmentTrigger && dayRand() > 0.55) {
            stock += Math.round(baseDailyUnits * (4.5 + dayRand() * 2.25));
          }
          const reservedQty = Math.max(0, Math.round(stock * 0.06));
          inventoryState.set(inventoryKey, stock);
          await inventoryInsert.run(channel.product_id, channel.marketplace_id, currentDateKey, stock, reservedQty);
          inventoryRowsInserted += 1;
        }
      }
    }

    return {
      ordersInserted,
      orderItemsInserted,
      inventoryRowsInserted,
    };
  });

  return {
    days,
    products: rowsByProduct.size,
    marketplaces: rows.length,
    ordersInserted: counts.ordersInserted,
    orderItemsInserted: counts.orderItemsInserted,
    inventoryRowsInserted: counts.inventoryRowsInserted,
    startDate: toDateKey(startDate),
    endDate: toDateKey(endDate),
  };
}
