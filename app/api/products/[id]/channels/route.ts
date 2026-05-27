import { NextRequest, NextResponse } from "next/server";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

import { recalculateCostResultsForProductFromDatabase } from "@/lib/cost-engine";
import { getDb } from "@/lib/db";
import { getMarketplaceBySlug, getOwnWebsiteGatewayRule, getProductMarketplaceSetting } from "@/lib/database-readers";

export const dynamic = "force-dynamic";

type ChannelSlug = "trendyol" | "hepsiburada" | "my_website";

type ChannelPayload = {
  slug?: string;
  enabled?: boolean;
  salePrice?: number | string | null;
  buyboxPrice?: number | string | null;
  manualShippingCost?: number | string | null;
  shippingCompanyId?: number | string | null;
};

function parseProductId(value: string | undefined | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeChannelSlug(value: unknown): ChannelSlug | null {
  if (value === "trendyol" || value === "hepsiburada" || value === "my_website") {
    return value;
  }

  if (value === "own_website" || value === "own-website" || value === "website") {
    return "my_website";
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

async function getDefaultMarketplaceShippingCompanyId(db: NonNullable<ReturnType<typeof getDb>>, marketplaceId: number) {
  const row = await db
    .prepare(
      `
        SELECT shipping_company_id
        FROM marketplace_shipping_options
        WHERE marketplace_id = ?
        ORDER BY shipping_company_id ASC
        LIMIT 1
      `
    )
    .get(marketplaceId) as { shipping_company_id: number | null } | undefined;
  return row?.shipping_company_id ?? null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  primeRequestContextFromApiContext(session);
  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (!productId) {
      return NextResponse.json({ success: false, error: "Geçersiz ürün kimliği." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    const authUserId = session.authUserId?.trim() || "";
    if (!authUserId) {
      return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
    }

    const existingProduct = await db
      .prepare("SELECT product_id FROM products WHERE product_id = ? AND user_id = ? LIMIT 1")
      .get(productId, authUserId) as { product_id: number } | undefined;
    if (!existingProduct) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { channels?: ChannelPayload[] } | null;
    const items = Array.isArray(body?.channels) ? body!.channels : [];
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "Channel settings are required" }, { status: 400 });
    }

    const deleteSetting = db.prepare("DELETE FROM product_marketplace_settings WHERE product_id = ? AND marketplace_id = ? AND user_id = ?");
    const insertSetting = db.prepare(`
      INSERT INTO product_marketplace_settings (
        product_id,
        marketplace_id,
        shipping_company_id,
        sale_price,
        buybox_price,
        manual_shipping_cost,
        payment_gateway_rule_id,
        shipping_mode,
        traffic_cpa
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    await db.transaction(async () => {
      for (const record of items) {
        const slug = normalizeChannelSlug(record.slug);
        if (!slug) {
          throw new Error(`Geçersiz satış kanalı: ${String(record.slug)}`);
        }

        const marketplaceSlug = slug === "my_website" ? "own_website" : slug;
        const marketplace = await getMarketplaceBySlug(marketplaceSlug);
        if (!marketplace) {
          throw new Error(`Marketplace bulunamadı: ${marketplaceSlug}`);
        }

        const isEnabled = Boolean(record.enabled);
        if (!isEnabled) {
          await deleteSetting.run(productId, marketplace.id, authUserId);
          continue;
        }

        const existingSetting = await getProductMarketplaceSetting(productId, marketplace.id);
        const salePrice = readNumber(record.salePrice ?? existingSetting?.sale_price);
        if (salePrice == null || salePrice <= 0) {
          throw new Error(`${marketplace.name} için satış fiyatı geçerli olmalıdır.`);
        }
        const buyboxPrice = readNumber(record.buyboxPrice ?? existingSetting?.buybox_price);

        const shippingCompanyId =
          slug === "my_website"
            ? null
            : readNumber(record.shippingCompanyId ?? existingSetting?.shipping_company_id ?? await getDefaultMarketplaceShippingCompanyId(db, marketplace.id));
        const resolvedShippingCompanyId = shippingCompanyId != null && shippingCompanyId > 0
          ? shippingCompanyId
          : slug === "my_website"
            ? null
            : await getDefaultMarketplaceShippingCompanyId(db, marketplace.id);
        const gatewayRule = slug === "my_website" ? await getOwnWebsiteGatewayRule() : null;
        const manualShippingCostInput = readNumber(
          record.manualShippingCost ?? existingSetting?.manual_shipping_cost
        );
        const manualShippingCost =
          slug === "my_website"
            ? Number(
                manualShippingCostInput ??
                  existingSetting?.manual_shipping_cost ??
                  gatewayRule?.manual_shipping_cost ??
                  95
              )
            : null;
        const paymentGatewayRuleId = slug === "my_website" ? existingSetting?.payment_gateway_rule_id ?? gatewayRule?.id ?? null : null;
        const shippingMode = slug === "my_website" ? existingSetting?.shipping_mode ?? "manual" : existingSetting?.shipping_mode ?? "marketplace_rate";
        const trafficCpa = existingSetting?.traffic_cpa ?? null;

        await deleteSetting.run(productId, marketplace.id, authUserId);
        await insertSetting.run(
          productId,
          marketplace.id,
          resolvedShippingCompanyId,
          salePrice,
          buyboxPrice,
          manualShippingCost,
          paymentGatewayRuleId,
          shippingMode,
          trafficCpa
        );
      }
    });

    const results = await recalculateCostResultsForProductFromDatabase(productId);

    return NextResponse.json({
      success: true,
      productId,
      results,
    });
  } catch (error) {
    console.error("Product channel settings error:", error);
    const message = error instanceof Error ? error.message : "Channel settings could not be updated";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
