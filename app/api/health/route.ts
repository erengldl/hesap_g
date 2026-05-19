import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, status: "degraded" }, { status: 503 });
    }

    db.prepare("SELECT 1").get();

    return NextResponse.json({
      success: true,
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ success: false, status: "degraded" }, { status: 503 });
  }
}
