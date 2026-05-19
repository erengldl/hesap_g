import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Webhook echo endpoint is ready.",
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  return NextResponse.json({
    success: true,
    received: payload,
  });
}
