import { NextResponse } from "next/server";
import { getDb, query } from "@/lib/db";
import { getStoreExpenseMonthlyTotal } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import type { StoreExpenseUpsertInput } from "@/lib/types";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";
import { getCurrentSellerProfileId, getOrCreateCurrentSellerProfileId } from "@/lib/seller-profile-helpers";

export const dynamic = "force-dynamic";

function normalizeStatus(status: string | undefined | null) {
  return status === "passive" || status === "draft" ? status : "active";
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const profileId = await getCurrentSellerProfileId();
    if (!profileId) {
      return NextResponse.json({
        success: true,
        expenses: [],
        count: 0,
        active_count: 0,
        total_active_monthly_amount: 0,
      });
    }

    const expenses = await query<{
      expense_id: number;
      profile_id: number | null;
      name: string;
      monthly_amount: number | null;
      note: string | null;
      status: string | null;
    }>(`
      SELECT expense_id, profile_id, name, monthly_amount, note, status
      FROM store_expenses
      WHERE profile_id = ? AND user_id = ?
      ORDER BY expense_id ASC
    `, [profileId, authUserId]);

    const activeExpenses = expenses.filter((expense) => (expense.status ?? "active") === "active");

    return NextResponse.json({
      success: true,
      expenses,
      count: expenses.length,
      active_count: activeExpenses.length,
      total_active_monthly_amount: Number((await getStoreExpenseMonthlyTotal(profileId)).toFixed(2)),
    });
  } catch (error) {
    console.error("Store expenses GET error:", error);
    return NextResponse.json({ success: false, error: "Giderler yüklenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const body = (await request.json()) as Partial<StoreExpenseUpsertInput>;
    const name = String(body.name ?? "").trim();
    const monthlyAmount = Number(body.monthly_amount ?? 0);
    const note = String(body.note ?? "").trim();
    const status = normalizeStatus(body.status);

    if (!name) {
      return NextResponse.json({ success: false, error: "Gider adı zorunludur." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabanı bağlantısı kullanılamıyor." }, { status: 500 });
    }

    const profileId = await getOrCreateCurrentSellerProfileId();

    await db.prepare(`
      INSERT INTO store_expenses (profile_id, user_id, name, monthly_amount, note, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(profileId, authUserId, name, monthlyAmount, note || null, status);

    await recalculateAllCostResults();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Store expenses POST error:", error);
    return NextResponse.json({ success: false, error: "Gider oluşturulamadı." }, { status: 500 });
  }
}
