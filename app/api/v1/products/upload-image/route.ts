import { NextResponse } from "next/server";
import { deleteProductImageUpload, saveProductImageUpload } from "@/lib/product-image-upload";
import { getDb } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  if (!session.authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Dosya bulunamadı." }, { status: 400 });
    }

    const localUpload = await saveProductImageUpload(file, session.authUserId);
    return NextResponse.json({
      success: true,
      ...localUpload,
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    return NextResponse.json({ success: false, error: "Görsel yüklenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "Görsel URL bulunamadı." }, { status: 400 });
    }

    const db = getDb();
    let allowLegacyDeletion = false;
    if (db) {
      const legacyOwner = await db.prepare(`
        SELECT product_id
        FROM products
        WHERE user_id = ? AND image_url = ?
        LIMIT 1
      `).get(authUserId, imageUrl) as { product_id: number } | undefined;
      allowLegacyDeletion = Boolean(legacyOwner);
    }

    const deleted = await deleteProductImageUpload(imageUrl, {
      authUserId,
      allowLegacyDeletion,
    });
    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error("Product image delete error:", error);
    return NextResponse.json({ success: false, error: "Görsel silinemedi." }, { status: 500 });
  }
}
