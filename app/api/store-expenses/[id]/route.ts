import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getStoreExpenseById } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import type { StoreExpenseUpsertInput } from "@/lib/types";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";

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
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  const { id } = await params;
  const expenseId = parseExpenseId(id);
  if (!expenseId) {
    return NextResponse.json({ success: false, error: "Geçersiz gider kimliği." }, { status: 400 });
  }

  try {
    const existing = await getStoreExpenseById(expenseId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Gider bulunamadı." }, { status: 404 });
    }

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

    await db.prepare(`
      UPDATE store_expenses
      SET name = ?, monthly_amount = ?, note = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE expense_id = ? AND user_id = ?
    `).run(name, monthlyAmount, note || null, status, expenseId, authUserId);

    await recalculateAllCostResults();

    return NextResponse.json({ success: true, expenseId });
  } catch (error) {
    console.error("Store expenses PUT error:", error);
    return NextResponse.json({ success: false, error: "Gider güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  const { id } = await params;
  const expenseId = parseExpenseId(id);
  if (!expenseId) {
    return NextResponse.json({ success: false, error: "Geçersiz gider kimliği." }, { status: 400 });
  }

  try {
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabanı bağlantısı kullanılamıyor." }, { status: 500 });
    }

    await db.prepare("DELETE FROM store_expenses WHERE expense_id = ? AND user_id = ?").run(expenseId, authUserId);
    await recalculateAllCostResults();

    return NextResponse.json({ success: true, expenseId });
  } catch (error) {
    console.error("Store expenses DELETE error:", error);
    return NextResponse.json({ success: false, error: "Gider silinemedi." }, { status: 500 });
  }
}
