import { NextResponse } from "next/server";
import { saveProductImageUpload } from "@/lib/product-image-upload";
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

    const saved = await saveProductImageUpload(file);

    return NextResponse.json({
      success: true,
      ...saved,
    });
  } catch (error) {
    console.error("Product image upload error:", error);
    return NextResponse.json({ success: false, error: "Görsel yüklenemedi." }, { status: 500 });
  }
}
