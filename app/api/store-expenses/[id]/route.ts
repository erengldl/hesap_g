import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getStoreExpenseById } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import type { StoreExpenseUpsertInput } from "@/lib/types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

function parseExpenseId(id: string) {
  const parsed = Number(id);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStatus(status: string | undefined | null) {
  return status === "passive" || status === "draft" ? status : "active";
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const expenseId = parseExpenseId(id);
  if (!expenseId) {
    return NextResponse.json({ success: false, error: "Geçersiz gider kimliği." }, { status: 400 });
  }

  try {
    const existing = getStoreExpenseById(expenseId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    }

    const body = (await request.json()) as Partial<StoreExpenseUpsertInput>;
    const name = String(body.name ?? "").trim();
    const monthlyAmount = Number(body.monthly_amount ?? 0);
    const note = String(body.note ?? "").trim();
    const status = normalizeStatus(body.status);

    if (!name) {
      return NextResponse.json({ success: false, error: "Expense name is required" }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    await db.prepare(`
      UPDATE store_expenses
      SET name = ?, monthly_amount = ?, note = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE expense_id = ?
    `).run(name, monthlyAmount, note || null, status, expenseId);

    recalculateAllCostResults();

    return NextResponse.json({ success: true, expenseId });
  } catch (error) {
    console.error("Store expenses PUT error:", error);
    return NextResponse.json({ success: false, error: "Gider gҼncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const expenseId = parseExpenseId(id);
  if (!expenseId) {
    return NextResponse.json({ success: false, error: "Geçersiz gider kimliği." }, { status: 400 });
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    await db.prepare("DELETE FROM store_expenses WHERE expense_id = ?").run(expenseId);
    recalculateAllCostResults();

    return NextResponse.json({ success: true, expenseId });
  } catch (error) {
    console.error("Store expenses DELETE error:", error);
    return NextResponse.json({ success: false, error: "Gider silinemedi." }, { status: 500 });
  }
}
