import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isRemoteDatabase } from "@/lib/remote-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        success: false,
        status: "degraded",
        database_mode: "unavailable",
        timestamp: new Date().toISOString(),
      });
    }

    db.prepare("SELECT 1").get();

    return NextResponse.json({
      success: true,
      status: "ok",
      database_mode: isRemoteDatabase(db) ? "supabase" : "sqlite",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      success: false,
      status: "degraded",
      database_mode: "unavailable",
      timestamp: new Date().toISOString(),
    });
  }
}
