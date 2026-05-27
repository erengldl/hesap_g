import { NextResponse } from "next/server";
import { getOne, getDb } from "@/lib/db";
import { recalculateCostResultsForProfile } from "@/lib/portfolio-analytics";
import { getStoreExpenseMonthlyTotal } from "@/lib/database-readers";
import { primeRequestContextFromApiContext, requireAuth } from "@/lib/api-auth";
import { DEFAULT_SELLER_PROFILE, getCurrentSellerProfileId } from "@/lib/seller-profile-helpers";

export const dynamic = "force-dynamic";

type SellerProfilePayload = {
  company_type: string;
  tax_bracket: number;
  expected_monthly_order_count: number;
};

function getDefaultProfile() {
  return {
    profile_id: null,
    ...DEFAULT_SELLER_PROFILE,
  };
}

async function getProfileWithUnitCost(authUserId: string) {
  const profileId = await getCurrentSellerProfileId();
  const profile = await getOne<{
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
    WHERE user_id = ?
    LIMIT 1
  `, [authUserId]);

  const resolvedProfile = profile ?? getDefaultProfile();
  const totalFixedCost = profileId ? await getStoreExpenseMonthlyTotal(profileId) : 0;
  const expectedOrders = Math.max(1, Number(resolvedProfile.expected_monthly_order_count ?? 1));

  return {
    ...resolvedProfile,
    active_monthly_expense_total: Math.round(totalFixedCost * 100) / 100,
    unit_fixed_cost: Math.round((totalFixedCost / expectedOrders) * 100) / 100,
  };
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
    return NextResponse.json({
      success: true,
      profile: await getProfileWithUnitCost(authUserId),
    });
  } catch (error) {
    console.error("Seller profile GET error:", error);
    return NextResponse.json({ success: false, error: "Satıcı profili yüklenemedi." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }
  primeRequestContextFromApiContext(session);
  try {
    const body = (await request.json()) as Partial<SellerProfilePayload>;
    const db = getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Veritabanı bağlantısı kullanılamıyor." }, { status: 500 });
    }

    const payload = {
      company_type: String(body.company_type ?? DEFAULT_SELLER_PROFILE.company_type),
      tax_bracket: Number(body.tax_bracket ?? DEFAULT_SELLER_PROFILE.tax_bracket),
      expected_monthly_order_count: Number(body.expected_monthly_order_count ?? 1),
    };

    const existingProfileId = await getCurrentSellerProfileId();
    if (existingProfileId) {
      await db.prepare(`
        UPDATE seller_profiles
        SET company_type = ?,
            tax_bracket = ?,
            expected_monthly_order_count = ?
        WHERE profile_id = ? AND user_id = ?
      `).run(
        payload.company_type,
        payload.tax_bracket,
        payload.expected_monthly_order_count,
        existingProfileId,
        authUserId,
      );
    } else {
      await db.prepare(`
        INSERT INTO seller_profiles (
          company_type,
          tax_bracket,
          expected_monthly_order_count,
          user_id
        ) VALUES (?, ?, ?, ?)
      `).run(
        payload.company_type,
        payload.tax_bracket,
        payload.expected_monthly_order_count,
        authUserId,
      );
    }

    const profileId = await getCurrentSellerProfileId();
    if (profileId) {
      await recalculateCostResultsForProfile(profileId);
    }

    return NextResponse.json({
      success: true,
      profile: await getProfileWithUnitCost(authUserId),
    });
  } catch (error) {
    console.error("Seller profile PUT error:", error);
    return NextResponse.json({ success: false, error: "Satıcı profili kaydedilemedi." }, { status: 500 });
  }
}
