import { NextResponse } from "next/server";
import { getOne, getDb } from "@/lib/db";
import { recalculateCostResultsForProfile } from "@/lib/portfolio-analytics";
import { getStoreExpenseMonthlyTotal } from "@/lib/database-readers";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type SellerProfilePayload = {
  company_type: string;
  tax_bracket: number;
  expected_monthly_order_count: number;
};

function getDefaultProfile() {
  return {
    profile_id: 1,
    company_type: "Ã…ÂahÃ„Â±s Ã…Âirketi",
    tax_bracket: 20,
    expected_monthly_order_count: 500,
  };
}

function getProfileWithUnitCost() {
  const profile = getOne<{
    profile_id: number;
    company_type: string;
    tax_bracket: number | null;
    expected_monthly_order_count: number | null;
  }>(`
    SELECT
      profile_id,
      company_type,
      tax_bracket,
      expected_monthly_order_count
    FROM seller_profiles
    WHERE profile_id = 1
    LIMIT 1
  `) ?? getDefaultProfile();

  const totalFixedCost = getStoreExpenseMonthlyTotal(profile.profile_id ?? 1);
  const expectedOrders = Math.max(1, Number(profile.expected_monthly_order_count ?? 1));

  return {
    ...profile,
    active_monthly_expense_total: Math.round(totalFixedCost * 100) / 100,
    unit_fixed_cost: Math.round((totalFixedCost / expectedOrders) * 100) / 100,
  };
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json({
      success: true,
      profile: getProfileWithUnitCost(),
    });
  } catch (error) {
    console.error("Seller profile GET error:", error);
    return NextResponse.json({ success: false, error: "SatÃ„Â±cÃ„Â± profili yÃƒÂ¼klenemedi." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json()) as Partial<SellerProfilePayload>;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    const payload = {
      company_type: String(body.company_type ?? "Ã…ÂahÃ„Â±s Ã…Âirketi"),
      tax_bracket: Number(body.tax_bracket ?? 20),
      expected_monthly_order_count: Number(body.expected_monthly_order_count ?? 1),
    };

    db.prepare(`
      INSERT INTO seller_profiles (
        profile_id,
        company_type,
        tax_bracket,
        expected_monthly_order_count
      ) VALUES (1, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET
        company_type = excluded.company_type,
        tax_bracket = excluded.tax_bracket,
        expected_monthly_order_count = excluded.expected_monthly_order_count
    `).run(
      payload.company_type,
      payload.tax_bracket,
      payload.expected_monthly_order_count
    );

    recalculateCostResultsForProfile(1);

    return NextResponse.json({
      success: true,
      profile: getProfileWithUnitCost(),
    });
  } catch (error) {
    console.error("Seller profile PUT error:", error);
    return NextResponse.json({ success: false, error: "SatÃ„Â±cÃ„Â± profili kaydedilemedi." }, { status: 500 });
  }
}
