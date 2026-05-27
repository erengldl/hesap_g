import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/database-readers';
import { DEMO_PRODUCTS } from '@/lib/demo-data';
import { recalculateCostResultsForProduct } from '@/lib/portfolio-analytics';
import type { ProductUpsertInput } from '@/lib/types';
import { normalizeCreateProductPayload, validateCreateProductPayload } from './payload';
import { saveProductRecord } from './service';
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

function shouldAllowDemoFallback() {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_DEMO_FALLBACK === "true";
}

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const url = new URL(request.url);
    const dbProducts = await getProducts();
    const limit = Number(url.searchParams.get("limit") ?? 0);
    const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("tr");
    const products = dbProducts;
    const filteredProducts = query.length > 0
      ? products.filter((product) => {
          const haystack = [
            product.name,
            product.sku,
            product.barcode,
            product.category_name,
            product.category_path,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase("tr");

          return haystack.includes(query);
        })
      : products;
    const limitedProducts =
      Number.isFinite(limit) && limit > 0 ? filteredProducts.slice(0, limit) : filteredProducts;
    
    return NextResponse.json({ 
      success: true, 
      products: limitedProducts,
      count: limitedProducts.length,
    });
  } catch (error) {
    console.error("Products API error:", error);

    if (shouldAllowDemoFallback()) {
      return NextResponse.json({
        success: true,
        products: DEMO_PRODUCTS,
        count: DEMO_PRODUCTS.length,
        warning: "Database unavailable, using demo data",
      });
    }

    return NextResponse.json({ success: false, error: "Ürünler yüklenemedi." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const body = await request.json() as Partial<ProductUpsertInput>;
    const payload = normalizeCreateProductPayload(body);
    const validationErrors = validateCreateProductPayload(payload);

    if (validationErrors.length > 0) {
      return NextResponse.json({ success: false, error: validationErrors.join(" ") }, { status: 400 });
    }

    const productId = await saveProductRecord(payload);
    const results = await recalculateCostResultsForProduct(productId);

    return NextResponse.json({
      success: true,
      productId,
      results,
    });
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json({ success: false, error: 'Ürün oluşturulamadı.' }, { status: 500 });
  }
}
