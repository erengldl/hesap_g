import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return NextResponse.json(
    {
      success: false,
      error:
        "Bu endpoint artık doğrudan fiyat yayınlamaz. Onaylı fiyat uygulama akışı için /api/profit-pricing/apply-price kullanılmalı.",
    },
    { status: 409 }
  );
}
