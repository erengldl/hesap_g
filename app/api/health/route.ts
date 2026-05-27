import { NextResponse } from "next/server";
import { getDb, getDatabaseMode } from "@/lib/db";
import { hasDatabaseUrl } from "@/lib/database-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseConfigured = isSupabaseConfigured();
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
  const forecastServiceConfigured = Boolean(process.env.FORECAST_SERVICE_URL?.trim());

  if (!hasDatabaseUrl()) {
    return NextResponse.json({
      success: false,
      status: "degraded",
      services: {
        database: "down",
        auth: supabaseConfigured ? "ok" : "misconfigured",
        ai: aiConfigured ? "ok" : "misconfigured",
        forecast: forecastServiceConfigured ? "ok" : "misconfigured",
      },
      databaseMode: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const db = getDb();

    await db.prepare("SELECT 1").get();

    return NextResponse.json({
      success: true,
      status: "ok",
      services: {
        database: "ok",
        auth: supabaseConfigured ? "ok" : "misconfigured",
        ai: aiConfigured ? "ok" : "misconfigured",
        forecast: forecastServiceConfigured ? "ok" : "misconfigured",
      },
      databaseMode: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      status: "degraded",
      services: {
        database: "degraded",
        auth: supabaseConfigured ? "ok" : "misconfigured",
        ai: aiConfigured ? "ok" : "misconfigured",
        forecast: forecastServiceConfigured ? "ok" : "misconfigured",
      },
      databaseMode: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  }
}
