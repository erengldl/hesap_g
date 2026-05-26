import { NextResponse } from "next/server";
import { deleteProductImageUpload, saveProductImageUpload } from "@/lib/product-image-upload";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Dosya bulunamadı." }, { status: 400 });
    }

    const localUpload = await saveProductImageUpload(file);
    return NextResponse.json({
      success: true,
      ...localUpload,
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    return NextResponse.json({ success: false, error: "GҶrsel yҼklenemedi." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const url = new URL(request.url);
    const imageUrl = url.searchParams.get("url");

    if (!imageUrl) {
      return NextResponse.json({ success: false, error: "Görsel URL bulunamadı." }, { status: 400 });
    }

    const deleted = await deleteProductImageUpload(imageUrl);
    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error("Product image delete error:", error);
    return NextResponse.json({ success: false, error: "GҶrsel silinemedi." }, { status: 500 });
  }
}
