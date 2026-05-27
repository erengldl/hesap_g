import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getProducts } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Tüm ürünler veri merkezine yüklenemedi." }, { status: 500 });
    }

    const products = await getProducts();
    const productCount = products.length;
    const activeProductCount = products.filter((product) => (product.status ?? "draft") === "active").length;
    const processedProducts = await recalculateAllCostResults();
    const syncedAt = new Date().toISOString();
    const note =
      productCount > 0
        ? `${productCount} ürün veri merkezine yüklendi.`
        : "Veri merkezinde yüklenecek gerçek ürün bulunamadı.";

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
    ).run("all_products", productCount, processedProducts, note, syncedAt);

    return NextResponse.json({
      success: true,
      product_count: productCount,
      active_product_count: activeProductCount,
      processed_products: processedProducts,
      last_bulk_sync_time: syncedAt,
      message: note,
    });
  } catch (error) {
    console.error("Data center sync error:", error);
    return NextResponse.json({ success: false, error: "Tüm ürünler veri merkezine yüklenemedi." }, { status: 500 });
  }
}
