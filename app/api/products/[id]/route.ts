import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recalculateCostResultsForProductFromDatabase } from "@/lib/cost-engine";
import { getProductMarginSnapshots, getProductOrderHistory, getProductSalesTrend, summarizeProductTrend, buildProductDescriptionFallback } from "@/lib/product-history";
import { buildDemoProductDetailResponse } from "@/lib/demo-product-detail";
import { deleteProductImageUpload } from "@/lib/product-image-upload";
import type { ProductUpsertInput } from "@/lib/types";
import { deleteProductRecord, saveProductRecord } from "../service";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type ExistingProductRow = {
  product_id: number;
  name: string;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  category_id: number | null;
  category_path: string | null;
  description: string | null;
  cost: number | null;
  packaging_cost: number | null;
  desi: number | null;
  status: string | null;
  stock_qty?: number | null;
};

type ExistingProductChannelRow = {
  slug: string;
  sale_price: number | null;
  buybox_price: number | null;
  shipping_company_id: number | null;
};

function parseProductId(value: string | undefined | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getExistingProductChannelState(productId: number) {
  const db = getDb();
  if (!db) {
    return {
      activeChannels: [] as string[],
      salePrice: undefined as number | undefined,
    };
  }

  const rows = db.prepare(`
    SELECT
      m.slug,
      pms.sale_price
      , pms.shipping_company_id
    FROM product_marketplace_settings pms
    JOIN marketplaces m ON pms.marketplace_id = m.marketplace_id
    WHERE pms.product_id = ?
    ORDER BY CASE WHEN m.slug = 'own_website' THEN 0 ELSE 1 END, pms.marketplace_id ASC
  `).all(productId) as ExistingProductChannelRow[];

  const activeChannels = rows
    .map((row) => (row.slug === "own_website" ? "my_website" : row.slug))
    .filter((channel): channel is string => channel === "trendyol" || channel === "hepsiburada" || channel === "my_website");

    const salePrice = rows.find((row) => typeof row.sale_price === "number" && Number.isFinite(row.sale_price))?.sale_price ?? undefined;

    return { activeChannels, salePrice };
  }

function parseProductPayload(
  body: Partial<ProductUpsertInput>,
  existing?: ExistingProductRow,
  existingActiveChannels: string[] = [],
  existingSalePrice?: number
): ProductUpsertInput {
  const parsedCategoryId = Number(body.category_id ?? existing?.category_id ?? 0);
  const name = String(body.name ?? existing?.name ?? "").trim();
  const sku = String(body.sku ?? existing?.sku ?? "").trim() || undefined;
  const barcode = String(body.barcode ?? existing?.barcode ?? sku ?? "").trim() || undefined;
  const imageUrlProvided = Object.prototype.hasOwnProperty.call(body, "image_url");
  const imageUrl = imageUrlProvided
    ? String(body.image_url ?? "").trim() || undefined
    : String(existing?.image_url ?? "").trim() || undefined;
  const categoryPath = String(body.category_path ?? existing?.category_path ?? "").trim();
  const description = String(body.description ?? existing?.description ?? "").trim() || undefined;
  const cost = Number(body.cost ?? existing?.cost ?? 0);
  const packagingCost = Number(body.packaging_cost ?? existing?.packaging_cost ?? 0);
  const desi = Number(body.desi ?? existing?.desi ?? 0);
  const salePrice = Number(body.sale_price ?? existingSalePrice ?? 0);
  const activeChannels =
    Array.isArray(body.active_channels) && body.active_channels.length > 0
      ? body.active_channels.map(String)
      : existingActiveChannels;
  const status = body.status === "passive" || body.status === "draft" ? body.status : existing?.status === "passive" || existing?.status === "draft" ? existing.status : "active";

  return {
    name,
    sku,
    barcode,
    image_url: imageUrl,
    category_id: Number.isFinite(parsedCategoryId) && parsedCategoryId > 0 ? parsedCategoryId : null,
    category_path: categoryPath,
    description,
    cost,
    packaging_cost: packagingCost,
    desi,
    sale_price: salePrice,
    active_channels: activeChannels,
    status: status as ProductUpsertInput["status"],
  };
}

function getExistingProduct(productId: number) {
  const db = getDb();
  if (!db) {
    return null;
  }

  return db.prepare(`
    SELECT
      p.product_id,
      p.name,
      p.sku,
      p.barcode,
      p.image_url,
      p.category_id,
      p.category_path,
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
    WHERE p.product_id = ?
    LIMIT 1
  `).get(productId) as ExistingProductRow | undefined ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  let productId: number | null = null;
  try {
    const { id } = await params;
    productId = parseProductId(id);
    if (!productId) {
      return NextResponse.json({ success: false, error: "GeÃƒÂ§ersiz ÃƒÂ¼rÃƒÂ¼n kimliÃ„Å¸i." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json(buildDemoProductDetailResponse(productId));
    }

    const product = db.prepare(`
      SELECT
        p.product_id,
        p.name,
        p.sku,
        p.barcode,
        p.image_url,
        p.category_id,
        p.category_path,
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
        ) AS stock_qty,
        c.name AS category_name,
        c.path AS category_path_full
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id = ?
      LIMIT 1
    `).get(productId) as
      | (ExistingProductRow & { category_name: string | null; category_path_full: string | null })
      | undefined;

    if (!product) {
      return NextResponse.json(buildDemoProductDetailResponse(productId));
    }

    const channels = db.prepare(`
      SELECT
        m.marketplace_id,
        m.name AS channel_name,
        m.slug,
        pms.sale_price,
        pms.buybox_price,
        pms.shipping_company_id,
        pms.manual_shipping_cost,
        pms.shipping_mode
      FROM product_marketplace_settings pms
      JOIN marketplaces m ON pms.marketplace_id = m.marketplace_id
      WHERE pms.product_id = ?
      ORDER BY m.marketplace_id ASC
    `).all(productId) as Array<{
      marketplace_id: number;
      channel_name: string;
        slug: string;
        sale_price: number | null;
        buybox_price: number | null;
        shipping_company_id: number | null;
        manual_shipping_cost: number | null;
        shipping_mode: string | null;
    }>;

    const costResults = recalculateCostResultsForProductFromDatabase(productId);
    const marginSnapshots = getProductMarginSnapshots(productId);
    const salesTrend30 = getProductSalesTrend(productId, 30);
    const salesTrend90 = getProductSalesTrend(productId, 90);
    const orderHistory = getProductOrderHistory(productId, 24);
    const summary30 = summarizeProductTrend(salesTrend30);
    const summary90 = summarizeProductTrend(salesTrend90);
    const bestChannel = marginSnapshots[0] ?? null;
    const marginStatus =
      bestChannel && bestChannel.profit_margin_percent >= 30
        ? "healthy"
        : bestChannel && bestChannel.profit_margin_percent >= 15
          ? "watch"
          : "risk";

    return NextResponse.json({
      success: true,
      product: {
        id: product.product_id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode ?? product.sku,
        categoryPath: product.category_path,
        categoryName: product.category_name,
        imageUrl: product.image_url,
        description: product.description ?? buildProductDescriptionFallback({
          name: product.name,
          category_path: product.category_path ?? product.category_path_full ?? undefined,
          category_name: product.category_name ?? undefined,
          cost: Number(product.cost ?? 0),
          packaging_cost: Number(product.packaging_cost ?? 0),
          sale_price: channels.find((channel) => channel.slug === "own_website")?.sale_price ?? Number(product.cost ?? 0),
        }),
        cost: product.cost,
        packagingCost: product.packaging_cost,
        desi: product.desi,
        status: product.status,
        stock: Number(product.stock_qty ?? 0),
      },
      channels: channels.map((ch) => {
        const cr = costResults.find((c) => c.marketplace_id === ch.marketplace_id);
        return {
          channelName: ch.channel_name,
          slug: ch.slug,
          salePrice: ch.sale_price,
          buyboxPrice: ch.buybox_price,
          shippingCompanyId: ch.shipping_company_id,
          shipping: ch.manual_shipping_cost,
          mode: ch.shipping_mode,
          totalCost: cr?.total_unit_cost ?? 0,
          netProfit: cr?.net_profit ?? 0,
          margin: cr?.profit_margin_percent ?? 0,
          warningNotes: cr?.warning_notes ?? null,
        };
      }),
      marginSnapshots,
      marginStatus,
      salesTrend30,
      salesTrend90,
      salesSummary30: summary30,
      salesSummary90: summary90,
      orderHistory,
    });
  } catch (error) {
    console.error("Product detail API error:", error);
    if (productId) {
      return NextResponse.json(buildDemoProductDetailResponse(productId));
    }
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (!productId) {
      return NextResponse.json({ success: false, error: "GeÃƒÂ§ersiz ÃƒÂ¼rÃƒÂ¼n kimliÃ„Å¸i." }, { status: 400 });
    }

    const existing = getExistingProduct(productId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    const channelState = getExistingProductChannelState(productId);
    const body = (await request.json().catch(() => ({}))) as Partial<ProductUpsertInput>;
    const imageUrlProvided = Object.prototype.hasOwnProperty.call(body, "image_url");
    const previousImageUrl = existing.image_url?.trim() || null;
    const payload = parseProductPayload(body, existing, channelState.activeChannels, channelState.salePrice);

    if (!payload.name || !payload.category_path) {
      return NextResponse.json({ success: false, error: "Product name and category are required" }, { status: 400 });
    }

    if (imageUrlProvided && previousImageUrl && previousImageUrl !== (payload.image_url ?? null)) {
      try {
        await deleteProductImageUpload(previousImageUrl);
      } catch (cleanupError) {
        console.warn("Product image cleanup warning:", cleanupError);
      }
    }

    const updatedProductId = saveProductRecord(payload, productId);
    const results = recalculateCostResultsForProductFromDatabase(updatedProductId);

    return NextResponse.json({
      success: true,
      productId: updatedProductId,
      results,
    });
  } catch (error) {
    console.error("Product update error:", error);
    return NextResponse.json({ success: false, error: "ÃƒÅ“rÃƒÂ¼n gÃƒÂ¼ncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await params;
    const productId = parseProductId(id);
    if (!productId) {
      return NextResponse.json({ success: false, error: "GeÃƒÂ§ersiz ÃƒÂ¼rÃƒÂ¼n kimliÃ„Å¸i." }, { status: 400 });
    }

    const existing = getExistingProduct(productId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    deleteProductRecord(productId);

    return NextResponse.json({
      success: true,
      productId,
    });
  } catch (error) {
    console.error("Product delete error:", error);
    return NextResponse.json({ success: false, error: "ÃƒÅ“rÃƒÂ¼n silinemedi." }, { status: 500 });
  }
}
