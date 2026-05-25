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
        "Bu endpoint artÃ„Â±k doÃ„Å¸rudan fiyat yayÃ„Â±nlamaz. OnaylÃ„Â± fiyat uygulama akÃ„Â±Ã…Å¸Ã„Â± iÃƒÂ§in /api/profit-pricing/apply-price kullanÃ„Â±lmalÃ„Â±.",
    },
    { status: 409 }
  );
}
