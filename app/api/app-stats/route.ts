import { NextResponse } from "next/server";
import { getDatabaseCounts } from "@/lib/database-readers";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);

  try {
    const counts = await getDatabaseCounts();

    return NextResponse.json({
      success: true,
      counts,
      dashboard_summary: {
        total_revenue: 0,
        total_orders: 0,
        avg_margin: 0,
        stock_alert_count: 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
}
