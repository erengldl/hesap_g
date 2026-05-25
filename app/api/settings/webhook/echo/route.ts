import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  return NextResponse.json({
    success: true,
    message: "Webhook echo endpoint is ready.",
  });
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const payload = await request.json().catch(() => null);

  return NextResponse.json({
    success: true,
    received: payload,
  });
}
