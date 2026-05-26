import { NextResponse } from "next/server";
import { getDb, getDatabaseMode } from "@/lib/db";
import { classifyDatabaseError } from "@/lib/database-error";
import { hasDatabaseUrl } from "@/lib/database-url";

export const dynamic = "force-dynamic";

export async function GET() {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
  const geminiModel = process.env.GEMINI_MODEL?.trim() || null;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      success: false,
      status: "degraded",
      database_mode: getDatabaseMode(),
      db_configured: false,
      db_error_code: "missing_database_url",
      db_error_message: "Production veritabani baglanti degiskeni eksik.",
      gemini_configured: geminiApiKey.length > 0,
      gemini_model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const db = getDb();

    await db.prepare("SELECT 1").get();

    return NextResponse.json({
      success: true,
      status: "ok",
      database_mode: getDatabaseMode(),
      db_configured: true,
      gemini_configured: geminiApiKey.length > 0,
      gemini_model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const dbError = classifyDatabaseError(error);
    return NextResponse.json({
      success: false,
      status: "degraded",
      database_mode: getDatabaseMode(),
      db_configured: true,
      db_error_code: dbError.code,
      db_error_message: dbError.message,
      gemini_configured: geminiApiKey.length > 0,
      gemini_model: geminiModel,
      timestamp: new Date().toISOString(),
    });
  }
}
