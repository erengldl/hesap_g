import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { recalculateCostResultsForProduct } from "@/lib/portfolio-analytics";
import type { ProductUpsertInput } from "@/lib/types";

import { normalizeCreateProductPayload, validateCreateProductPayload } from "../payload";
import { saveProductRecord } from "../service";

export const dynamic = "force-dynamic";

type ProductBulkImportItem = {
  rowNumber?: number;
  product?: Partial<ProductUpsertInput>;
};

type ProductBulkImportError = {
  rowNumber: number;
  name: string;
  error: string;
};

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  try {
    const body = (await request.json().catch(() => ({}))) as { items?: ProductBulkImportItem[] };
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "İçe aktarılacak ürün bulunamadı." }, { status: 400 });
    }

    if (items.length > 100) {
      return NextResponse.json({ success: false, error: "Tek seferde en fazla 100 ürün işlenebilir." }, { status: 400 });
    }

    const errors: ProductBulkImportError[] = [];
    const productIds: number[] = [];

    for (const [index, item] of items.entries()) {
      const payload = normalizeCreateProductPayload(item.product ?? {});
      const rowNumber = Number.isFinite(item.rowNumber) ? Number(item.rowNumber) : index + 2;
      const validationErrors = validateCreateProductPayload(payload);

      if (validationErrors.length > 0) {
        errors.push({
          rowNumber,
          name: payload.name || `Satır ${rowNumber}`,
          error: validationErrors.join(" "),
        });
        continue;
      }

      try {
        const productId = await saveProductRecord(payload);
        await recalculateCostResultsForProduct(productId);
        productIds.push(productId);
      } catch (error) {
        errors.push({
          rowNumber,
          name: payload.name || `Satır ${rowNumber}`,
          error: error instanceof Error ? error.message : "Ürün kaydedilemedi.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: items.length,
      success_count: productIds.length,
      error_count: errors.length,
      product_ids: productIds,
      errors,
    });
  } catch (error) {
    console.error("Bulk create product error:", error);
    return NextResponse.json({ success: false, error: "Toplu ürün içe aktarma başarısız oldu." }, { status: 500 });
  }
}
