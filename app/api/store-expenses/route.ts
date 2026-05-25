import { NextResponse } from "next/server";
import { getDb, query } from "@/lib/db";
import { getStoreExpenseMonthlyTotal } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import type { StoreExpenseUpsertInput } from "@/lib/types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function normalizeStatus(status: string | undefined | null) {
  return status === "passive" || status === "draft" ? status : "active";
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const expenses = query<{
      expense_id: number;
      profile_id: number | null;
      name: string;
      monthly_amount: number | null;
      note: string | null;
      status: string | null;
    }>(`
      SELECT expense_id, profile_id, name, monthly_amount, note, status
      FROM store_expenses
      WHERE profile_id = 1
      ORDER BY expense_id ASC
    `);

    const activeExpenses = expenses.filter((expense) => (expense.status ?? "active") === "active");

    return NextResponse.json({
      success: true,
      expenses,
      count: expenses.length,
      active_count: activeExpenses.length,
      total_active_monthly_amount: Number(getStoreExpenseMonthlyTotal(1).toFixed(2)),
    });
  } catch (error) {
    console.error("Store expenses GET error:", error);
    return NextResponse.json({ success: false, error: "Giderler yÃƒÂ¼klenemedi." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json()) as Partial<StoreExpenseUpsertInput>;
    const name = String(body.name ?? "").trim();
    const monthlyAmount = Number(body.monthly_amount ?? 0);
    const note = String(body.note ?? "").trim();
    const status = normalizeStatus(body.status);

    if (!name) {
      return NextResponse.json({ success: false, error: "Gider adÃ„Â± zorunludur." }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "VeritabanÃ„Â± baÃ„Å¸lantÃ„Â±sÃ„Â± kullanÃ„Â±lamÃ„Â±yor." }, { status: 500 });
    }

    db.prepare(`
      INSERT INTO store_expenses (profile_id, name, monthly_amount, note, status)
      VALUES (1, ?, ?, ?, ?)
    `).run(name, monthlyAmount, note || null, status);

    recalculateAllCostResults();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Store expenses POST error:", error);
    return NextResponse.json({ success: false, error: "Gider oluÃ…Å¸turulamadÃ„Â±." }, { status: 500 });
  }
}
