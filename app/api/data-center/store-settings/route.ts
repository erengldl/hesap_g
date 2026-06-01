import { NextResponse } from "next/server";

import { getDb, getOne } from "@/lib/db";
import { recalculateAllCostResults } from "@/lib/portfolio-analytics";
import {
  DEFAULT_STORE_SETTINGS,
  buildStoreSettingsMissingFields,
  normalizePackagingBehavior,
  type StoreSettingsData,
} from "@/lib/store-settings";

export const dynamic = "force-dynamic";

type SellerProfileRow = {
  profile_id: number;
  company_type: string | null;
  tax_bracket: number | null;
  expected_monthly_order_count: number | null;
  monthly_fixed_expenses: number | null;
  marketplace_expenses: number | null;
  operational_costs: number | null;
  default_margin_target: number | null;
  default_commission: number | null;
  default_packaging_cost: number | null;
  default_risk_threshold: number | null;
};

type WebsiteRuleRow = {
  id: number;
  gateway_name: string | null;
  fee_rate_percent: number | null;
  fixed_fee_per_order: number | null;
  fee_values_include_vat: number | null;
  manual_shipping_cost: number | null;
  avg_ad_cost: number | null;
  avg_conversion_rate: number | null;
  packaging_behavior: string | null;
  free_shipping_threshold: number | null;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getOwnWebsiteMarketplaceId() {
  const row = getOne<{ marketplace_id: number }>(`
    SELECT marketplace_id
    FROM marketplaces
    WHERE slug = 'own_website'
    LIMIT 1
  `);

  return Number(row?.marketplace_id ?? 3);
}

function getLegacyExpenseTotal(profileId = 1) {
  const row = getOne<{ total: number | null }>(`
    SELECT SUM(monthly_amount) AS total
    FROM store_expenses
    WHERE profile_id = ? AND COALESCE(status, 'active') = 'active'
  `, [profileId]);

  return round2(Number(row?.total ?? 0));
}

function getAveragePackagingCost() {
  const row = getOne<{ average_packaging_cost: number | null }>(`
    SELECT AVG(packaging_cost) AS average_packaging_cost
    FROM products
  `);

  return round2(Number(row?.average_packaging_cost ?? 0));
}

function getStoreSettings() {
  const sellerProfile = getOne<SellerProfileRow>(`
    SELECT
      profile_id,
      company_type,
      tax_bracket,
      expected_monthly_order_count,
      monthly_fixed_expenses,
      marketplace_expenses,
      operational_costs,
      default_margin_target,
      default_commission,
      default_packaging_cost,
      default_risk_threshold
    FROM seller_profiles
    WHERE profile_id = 1
    LIMIT 1
  `);

  const websiteRule = getOne<WebsiteRuleRow>(`
    SELECT
      id,
      gateway_name,
      fee_rate_percent,
      fixed_fee_per_order,
      fee_values_include_vat,
      manual_shipping_cost,
      avg_ad_cost,
      avg_conversion_rate,
      packaging_behavior,
      free_shipping_threshold
    FROM payment_gateway_rules
    WHERE marketplace_id = ?
    ORDER BY id ASC
    LIMIT 1
  `, [getOwnWebsiteMarketplaceId()]);

  const hasGroupedExpenseAssumptions =
    sellerProfile?.monthly_fixed_expenses !== null ||
    sellerProfile?.marketplace_expenses !== null ||
    sellerProfile?.operational_costs !== null;
  const legacyExpenseTotal = hasGroupedExpenseAssumptions ? 0 : getLegacyExpenseTotal(1);
  const averagePackagingCost = getAveragePackagingCost();

  const settings: StoreSettingsData = {
    ownWebsite: {
      shippingCost: toNullableNumber(websiteRule?.manual_shipping_cost ?? DEFAULT_STORE_SETTINGS.ownWebsite.shippingCost),
      paymentCommission: toNullableNumber(websiteRule?.fee_rate_percent ?? DEFAULT_STORE_SETTINGS.ownWebsite.paymentCommission),
      packagingBehavior: normalizePackagingBehavior(
        websiteRule?.packaging_behavior ?? DEFAULT_STORE_SETTINGS.ownWebsite.packagingBehavior
      ),
      freeShippingThreshold: toNullableNumber(
        websiteRule?.free_shipping_threshold ?? DEFAULT_STORE_SETTINGS.ownWebsite.freeShippingThreshold
      ),
    },
    expenses: {
      monthlyFixedExpenses: toNullableNumber(
        sellerProfile?.monthly_fixed_expenses ?? legacyExpenseTotal ?? DEFAULT_STORE_SETTINGS.expenses.monthlyFixedExpenses
      ),
      marketplaceExpenses: toNullableNumber(
        sellerProfile?.marketplace_expenses ?? DEFAULT_STORE_SETTINGS.expenses.marketplaceExpenses
      ),
      operationalCosts: toNullableNumber(
        sellerProfile?.operational_costs ?? DEFAULT_STORE_SETTINGS.expenses.operationalCosts
      ),
    },
    sellerProfile: {
      businessType: String(sellerProfile?.company_type ?? DEFAULT_STORE_SETTINGS.sellerProfile.businessType),
      defaultTaxAssumptions: toNullableNumber(
        sellerProfile?.tax_bracket ?? DEFAULT_STORE_SETTINGS.sellerProfile.defaultTaxAssumptions
      ),
      defaultMarginTarget: toNullableNumber(
        sellerProfile?.default_margin_target ?? DEFAULT_STORE_SETTINGS.sellerProfile.defaultMarginTarget
      ),
      expectedMonthlyOrderCount: toNullableNumber(
        sellerProfile?.expected_monthly_order_count ?? DEFAULT_STORE_SETTINGS.sellerProfile.expectedMonthlyOrderCount
      ),
    },
    calculationDefaults: {
      defaultCommission: toNullableNumber(
        sellerProfile?.default_commission ??
          websiteRule?.fee_rate_percent ??
          DEFAULT_STORE_SETTINGS.calculationDefaults.defaultCommission
      ),
      defaultPackagingCost: toNullableNumber(
        sellerProfile?.default_packaging_cost ??
          averagePackagingCost ??
          DEFAULT_STORE_SETTINGS.calculationDefaults.defaultPackagingCost
      ),
      defaultRiskThreshold: toNullableNumber(
        sellerProfile?.default_risk_threshold ?? DEFAULT_STORE_SETTINGS.calculationDefaults.defaultRiskThreshold
      ),
    },
  };

  return {
    settings,
    missingFields: buildStoreSettingsMissingFields(settings),
  };
}

export async function GET() {
  try {
    const result = getStoreSettings();

    return NextResponse.json({
      success: true,
      settings: result.settings,
      missingFields: result.missingFields,
    });
  } catch (error) {
    console.error("Store settings GET error:", error);
    return NextResponse.json(
      { success: false, error: "Mağaza ayarları yüklenemedi." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<StoreSettingsData>;
    const db = getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, error: "Veritabanı bağlantısı kullanılamıyor." },
        { status: 500 }
      );
    }

    const ownWebsite = {
      shippingCost: toNullableNumber(body?.ownWebsite?.shippingCost),
      paymentCommission: toNullableNumber(body?.ownWebsite?.paymentCommission),
      packagingBehavior: normalizePackagingBehavior(body?.ownWebsite?.packagingBehavior),
      freeShippingThreshold: toNullableNumber(body?.ownWebsite?.freeShippingThreshold) ?? 0,
    };

    const expenses = {
      monthlyFixedExpenses: toNullableNumber(body?.expenses?.monthlyFixedExpenses),
      marketplaceExpenses: toNullableNumber(body?.expenses?.marketplaceExpenses) ?? 0,
      operationalCosts: toNullableNumber(body?.expenses?.operationalCosts) ?? 0,
    };

    const sellerProfile = {
      businessType: String(body?.sellerProfile?.businessType ?? DEFAULT_STORE_SETTINGS.sellerProfile.businessType),
      defaultTaxAssumptions: toNullableNumber(body?.sellerProfile?.defaultTaxAssumptions),
      defaultMarginTarget: toNullableNumber(body?.sellerProfile?.defaultMarginTarget),
      expectedMonthlyOrderCount: toNullableNumber(body?.sellerProfile?.expectedMonthlyOrderCount),
    };

    const calculationDefaults = {
      defaultCommission: toNullableNumber(body?.calculationDefaults?.defaultCommission),
      defaultPackagingCost: toNullableNumber(body?.calculationDefaults?.defaultPackagingCost),
      defaultRiskThreshold: toNullableNumber(body?.calculationDefaults?.defaultRiskThreshold),
    };

    const nextSettings: StoreSettingsData = {
      ownWebsite,
      expenses,
      sellerProfile,
      calculationDefaults,
    };
    const missingFields = buildStoreSettingsMissingFields(nextSettings);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Bazı zorunlu mağaza varsayımları eksik.",
          missingFields,
        },
        { status: 400 }
      );
    }

    const ownWebsiteMarketplaceId = getOwnWebsiteMarketplaceId();
    const existingRule = getOne<WebsiteRuleRow>(`
      SELECT
        id,
        gateway_name,
        fee_rate_percent,
        fixed_fee_per_order,
        fee_values_include_vat,
        avg_ad_cost,
        avg_conversion_rate,
        manual_shipping_cost,
        packaging_behavior,
        free_shipping_threshold
      FROM payment_gateway_rules
      WHERE marketplace_id = ?
      ORDER BY id ASC
      LIMIT 1
    `, [ownWebsiteMarketplaceId]);

    db.prepare(`
      INSERT INTO seller_profiles (
        profile_id,
        company_type,
        tax_bracket,
        expected_monthly_order_count,
        monthly_fixed_expenses,
        marketplace_expenses,
        operational_costs,
        default_margin_target,
        default_commission,
        default_packaging_cost,
        default_risk_threshold
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET
        company_type = excluded.company_type,
        tax_bracket = excluded.tax_bracket,
        expected_monthly_order_count = excluded.expected_monthly_order_count,
        monthly_fixed_expenses = excluded.monthly_fixed_expenses,
        marketplace_expenses = excluded.marketplace_expenses,
        operational_costs = excluded.operational_costs,
        default_margin_target = excluded.default_margin_target,
        default_commission = excluded.default_commission,
        default_packaging_cost = excluded.default_packaging_cost,
        default_risk_threshold = excluded.default_risk_threshold
    `).run(
      sellerProfile.businessType,
      sellerProfile.defaultTaxAssumptions,
      sellerProfile.expectedMonthlyOrderCount,
      expenses.monthlyFixedExpenses,
      expenses.marketplaceExpenses,
      expenses.operationalCosts,
      sellerProfile.defaultMarginTarget,
      calculationDefaults.defaultCommission,
      calculationDefaults.defaultPackagingCost,
      calculationDefaults.defaultRiskThreshold
    );

    if (existingRule) {
      db.prepare(`
        UPDATE payment_gateway_rules
        SET fee_rate_percent = ?,
            manual_shipping_cost = ?,
            packaging_behavior = ?,
            free_shipping_threshold = ?,
            seller_profile_id = 1,
            marketplace_id = ?
        WHERE id = ?
      `).run(
        ownWebsite.paymentCommission,
        ownWebsite.shippingCost,
        ownWebsite.packagingBehavior,
        ownWebsite.freeShippingThreshold,
        ownWebsiteMarketplaceId,
        existingRule.id
      );
    } else {
      db.prepare(`
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
          packaging_behavior,
          free_shipping_threshold,
          is_active
        ) VALUES (1, ?, ?, ?, ?, 20, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        ownWebsiteMarketplaceId,
        "Kullanıcı Tanımlı Ödeme Altyapısı",
        ownWebsite.paymentCommission,
        0.25,
        1,
        ownWebsite.shippingCost,
        56.2,
        2.6,
        ownWebsite.packagingBehavior,
        ownWebsite.freeShippingThreshold
      );
    }

    recalculateAllCostResults();

    const result = getStoreSettings();
    return NextResponse.json({
      success: true,
      settings: result.settings,
      missingFields: result.missingFields,
    });
  } catch (error) {
    console.error("Store settings PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Mağaza ayarları kaydedilemedi." },
      { status: 500 }
    );
  }
}
