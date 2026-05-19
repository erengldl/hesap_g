import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isRemoteDatabase } from "@/lib/remote-db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    const geminiModel = process.env.GEMINI_MODEL?.trim() || null;
    const db = getDb();
    if (!db) {
      return NextResponse.json({
        success: false,
        status: "degraded",
        database_mode: "unavailable",
        gemini_configured: geminiApiKey.length > 0,
        gemini_model: geminiModel,
        timestamp: new Date().toISOString(),
      });
    }

    db.prepare("SELECT 1").get();

    return NextResponse.json({
      success: true,
      status: "ok",
      database_mode: isRemoteDatabase(db) ? "supabase" : "sqlite",
      gemini_configured: geminiApiKey.length > 0,
      gemini_model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  } catch {
    const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
    const geminiModel = process.env.GEMINI_MODEL?.trim() || null;
    return NextResponse.json({
      success: false,
      status: "degraded",
      database_mode: "unavailable",
      gemini_configured: geminiApiKey.length > 0,
      gemini_model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  }
}
