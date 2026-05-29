import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Bu endpoint artık doğrudan fiyat yayınlamaz. Onaylı fiyat uygulama akışı için /api/profit-pricing/apply-price kullanılmalı.",
    },
    { status: 409 }
  );
}
