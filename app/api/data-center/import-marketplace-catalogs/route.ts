import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

async function readJsonPayload(response: Response) {
  const rawText = await response.text();
  const trimmedText = rawText.trim();
  if (!trimmedText) return null;

  try {
    return JSON.parse(trimmedText);
  } catch {
    return {
      success: false,
      error: trimmedText,
    };
  }
}

async function resolveMarketplaceSlug(authUserId: string) {
  const statusResponse = await proxyMarketplaceIntegrationRequest("/api/v1/integrations/status", {
    method: "GET",
  }, undefined, authUserId);
  const statusPayload = await readJsonPayload(statusResponse);

  if (!statusResponse.ok || !statusPayload?.success || !Array.isArray(statusPayload.marketplaces)) {
    return "all";
  }

  const connectedSlugs = statusPayload.marketplaces
    .filter((marketplace: { marketplace_slug?: string; is_active?: boolean; has_credentials?: boolean; connection_state?: string }) => {
      if (!marketplace?.marketplace_slug) return false;
      return Boolean(
        (marketplace.connection_state === "connected" || marketplace.connection_state === "degraded") &&
          marketplace.is_active &&
          marketplace.has_credentials
      );
    })
    .map((marketplace: { marketplace_slug: string }) => marketplace.marketplace_slug)
    .filter((slug: string) => slug === "trendyol" || slug === "hepsiburada");

  const uniqueSlugs = Array.from(new Set(connectedSlugs));
  if (uniqueSlugs.length === 1) {
    return uniqueSlugs[0];
  }

  return "all";
}

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);

  try {
    const marketplaceSlug = await resolveMarketplaceSlug(authUserId);
    const backendResponse = await proxyMarketplaceIntegrationRequest("/api/v1/integrations/catalogs/import", {
      method: "POST",
      body: JSON.stringify({ marketplace_slug: marketplaceSlug }),
    }, 180_000, authUserId);

    const backendPayload = await readJsonPayload(backendResponse);
    if (!backendResponse.ok || !backendPayload?.success) {
      return NextResponse.json(
        backendPayload ?? { success: false, error: "Marketplace catalog import failed." },
        { status: backendResponse.status || 502 }
      );
    }

    const recalculatedProducts = await recalculateAllCostResults();
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    const syncedAt = new Date().toISOString();
    const importedProducts = Number(backendPayload.products_created ?? 0) + Number(backendPayload.products_updated ?? 0);
    const totalProcessed = Number(backendPayload.products_created ?? 0) + Number(backendPayload.products_updated ?? 0) + Number(backendPayload.products_unchanged ?? 0);
    const note = backendPayload.marketplaces_processed?.length
      ? `${backendPayload.marketplaces_processed.join(", ")} katalogları içe aktarıldı. ${importedProducts} ürün güncellendi/eklendi.`
      : `${importedProducts} ürün içe aktarıldı.`;

    await db.prepare(
      `
      INSERT INTO data_center_sync_runs (
        sync_scope,
        product_count,
        processed_products,
        note,
        created_at
      ) VALUES (?, ?, ?, ?, ?)
      `
    ).run("marketplace_catalog_import", totalProcessed, recalculatedProducts, note, syncedAt);

    return NextResponse.json({
      success: true,
      sync_scope: "marketplace_catalog_import",
      marketplace_slug: backendPayload.marketplace_slug ?? "all",
      marketplaces_processed: backendPayload.marketplaces_processed ?? [],
      products_created: Number(backendPayload.products_created ?? 0),
      products_updated: Number(backendPayload.products_updated ?? 0),
      products_unchanged: Number(backendPayload.products_unchanged ?? 0),
      settings_upserted: Number(backendPayload.settings_upserted ?? 0),
      inventory_rows_upserted: Number(backendPayload.inventory_rows_upserted ?? 0),
      recalculated_products: recalculatedProducts,
      last_bulk_sync_time: syncedAt,
      message: note,
      warnings: Array.isArray(backendPayload.warnings) ? backendPayload.warnings : [],
    });
  } catch (error) {
    console.error("Marketplace catalog import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Pazaryeri katalogları içe aktarılamadı.",
      },
      { status: 500 }
    );
  }
}
