import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOwnWebsiteGatewayRule } from "@/lib/database-readers";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type WebsiteSettingsPayload = {
  gateway_name: string;
  commission_rate: number;
  fixed_fee: number;
  manual_shipping_cost: number;
  include_kdv: boolean;
  avg_ad_cost: number;
  avg_conversion_rate: number;
};

function getDefaultSettings() {
  return {
    gateway_name: "KullanÃ„Â±cÃ„Â± TanÃ„Â±mlÃ„Â± Ãƒâ€“deme AltyapÃ„Â±sÃ„Â±",
    commission_rate: 3.49,
    fixed_fee: 0.25,
    manual_shipping_cost: 95,
    include_kdv: true,
    avg_ad_cost: 56.2,
    avg_conversion_rate: 2.6,
  };
}

async function getSettings() {
  const rule = await getOwnWebsiteGatewayRule();
  if (!rule) {
    return {
      payment_gateway_rule_id: null,
      marketplace_id: 3,
      seller_profile_id: 1,
      ...getDefaultSettings(),
    };
  }

  return {
    payment_gateway_rule_id: rule.id,
    marketplace_id: rule.marketplace_id,
    seller_profile_id: rule.seller_profile_id ?? 1,
    gateway_name: rule.gateway_name,
    commission_rate: Number(rule.fee_rate_percent ?? 0),
    fixed_fee: Number(rule.fixed_fee_per_order ?? 0),
    manual_shipping_cost: Number(rule.manual_shipping_cost ?? 95),
    include_kdv: Boolean(rule.fee_values_include_vat),
    avg_ad_cost: Number(rule.avg_ad_cost ?? 0),
    avg_conversion_rate: Number(rule.avg_conversion_rate ?? 0),
  };
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    return NextResponse.json({
      success: true,
      settings: await getSettings(),
    });
  } catch (error) {
    console.error("Website settings GET error:", error);
    return NextResponse.json({ success: false, error: "Web sitesi ayarlarÃ„Â± yÃƒÂ¼klenemedi." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  try {
    const body = (await request.json()) as Partial<WebsiteSettingsPayload>;
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, error: "Database connection unavailable" }, { status: 500 });
    }

    const payload = {
      gateway_name: String(body.gateway_name ?? "KullanÃ„Â±cÃ„Â± TanÃ„Â±mlÃ„Â± Ãƒâ€“deme AltyapÃ„Â±sÃ„Â±"),
      commission_rate: Number(body.commission_rate ?? 3.49),
      fixed_fee: Number(body.fixed_fee ?? 0.25),
      manual_shipping_cost: Number(body.manual_shipping_cost ?? 95),
      include_kdv: Boolean(body.include_kdv ?? true),
      avg_ad_cost: Number(body.avg_ad_cost ?? 0),
      avg_conversion_rate: Number(body.avg_conversion_rate ?? 2.6),
    };

    const existing = await getOwnWebsiteGatewayRule();
    if (existing) {
      await db.prepare(`
        UPDATE payment_gateway_rules
        SET gateway_name = ?,
            fee_rate_percent = ?,
            fixed_fee_per_order = ?,
            fee_values_include_vat = ?,
            manual_shipping_cost = ?,
            avg_ad_cost = ?,
            avg_conversion_rate = ?,
            seller_profile_id = 1,
            marketplace_id = 3,
            is_active = 1
        WHERE id = ?
      `).run(
        payload.gateway_name,
        payload.commission_rate,
        payload.fixed_fee,
        payload.include_kdv ? 1 : 0,
        payload.manual_shipping_cost,
        payload.avg_ad_cost,
        payload.avg_conversion_rate,
        existing.id
      );
    } else {
      await db.prepare(`
        INSERT INTO payment_gateway_rules (
          seller_profile_id,
          marketplace_id,
          gateway_name,
          fee_rate_percent,
          fixed_fee_per_order,
          vat_rate_percent,
          fee_values_include_vat,
          manual_shipping_cost,
          avg_ad_cost,
          avg_conversion_rate,
          is_active
        ) VALUES (1, 3, ?, ?, ?, 20, ?, ?, ?, ?, 1)
      `).run(
        payload.gateway_name,
        payload.commission_rate,
        payload.fixed_fee,
        payload.include_kdv ? 1 : 0,
        payload.manual_shipping_cost,
        payload.avg_ad_cost,
        payload.avg_conversion_rate
      );
    }

    await recalculateAllCostResults();

    return NextResponse.json({
      success: true,
      settings: await getSettings(),
    });
  } catch (error) {
    console.error("Website settings PUT error:", error);
    return NextResponse.json({ success: false, error: "Web sitesi ayarlarÃ„Â± kaydedilemedi." }, { status: 500 });
  }
}
