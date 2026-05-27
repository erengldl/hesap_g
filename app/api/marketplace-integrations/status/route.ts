import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";
import type { MarketplaceIntegrationStatusItem, MarketplaceSlug } from "@/lib/marketplace-integration-types";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type LocalMarketplaceStatusRow = {
  marketplace_id: number;
  marketplace_slug: MarketplaceSlug | null;
  marketplace_name: string | null;
  merchant_id: string | null;
  is_active: number | null;
  last_sync_time: string | null;
  last_sync_scope: string | null;
  last_error: string | null;
  has_credentials: number;
};

const SUPPORTED_MARKETPLACES: Array<{
  marketplace_id: number;
  marketplace_slug: MarketplaceSlug;
  marketplace_name: string;
}> = [
  { marketplace_id: 1, marketplace_slug: "trendyol", marketplace_name: "Trendyol" },
  { marketplace_id: 2, marketplace_slug: "hepsiburada", marketplace_name: "Hepsiburada" },
];

async function buildLocalFallbackStatus(authUserId: string, serviceError?: string) {
  const rows = await query<LocalMarketplaceStatusRow>(`
    SELECT
      m.marketplace_id,
      m.slug AS marketplace_slug,
      m.name AS marketplace_name,
      mc.merchant_id,
      mc.is_active,
      mc.last_sync_time,
      mc.last_sync_scope,
      mc.last_error,
      CASE WHEN mc.credential_id IS NOT NULL THEN 1 ELSE 0 END AS has_credentials
    FROM marketplaces m
    LEFT JOIN marketplace_credentials mc ON mc.marketplace_id = m.marketplace_id AND mc.user_id = ?
    WHERE m.slug IN ('trendyol', 'hepsiburada')
    ORDER BY CASE m.slug
      WHEN 'trendyol' THEN 1
      WHEN 'hepsiburada' THEN 2
      ELSE 99
    END
  `, [authUserId]);

  const rowBySlug = new Map(
    rows
      .filter((row): row is LocalMarketplaceStatusRow & { marketplace_slug: MarketplaceSlug } => row.marketplace_slug === "trendyol" || row.marketplace_slug === "hepsiburada")
      .map((row) => [row.marketplace_slug, row])
  );

  const serviceUnavailableMessage = serviceError
    ? "Entegrasyon servisine ulaşılamıyor. Durum bilgisi lokal kayıttan gösteriliyor."
    : "Entegrasyon servisi çevrimdışı.";

  const marketplaces: MarketplaceIntegrationStatusItem[] = SUPPORTED_MARKETPLACES.map((fallbackMarketplace) => {
    const row = rowBySlug.get(fallbackMarketplace.marketplace_slug);
    const hasCredentials = Boolean(row?.has_credentials);
    const isActive = Boolean(row?.is_active);

    let connectionState: MarketplaceIntegrationStatusItem["connection_state"] = "disconnected";
    if (hasCredentials && isActive) {
      connectionState = "degraded";
    }

    return {
      marketplace_id: row?.marketplace_id ?? fallbackMarketplace.marketplace_id,
      marketplace_slug: fallbackMarketplace.marketplace_slug,
      marketplace_name: row?.marketplace_name ?? fallbackMarketplace.marketplace_name,
      merchant_id: row?.merchant_id ?? null,
      is_active: isActive,
      has_credentials: hasCredentials,
      connection_state: connectionState,
      api_key_masked: null,
      last_sync_time: row?.last_sync_time ?? null,
      last_sync_scope: row?.last_sync_scope ?? null,
      last_error: hasCredentials
        ? serviceUnavailableMessage
        : (row?.last_error ?? "Kimlik bilgisi tanımlı değil."),
    };
  });

  return NextResponse.json(
    {
      success: true,
      marketplaces,
      generated_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "x-marketplace-status-source": "local-fallback",
      },
    }
  );
}

export async function GET() {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }

  const response = await proxyMarketplaceIntegrationRequest("/api/v1/integrations/status", { method: "GET" }, undefined, authUserId);

  if (response.ok) {
    return response;
  }

  let serviceError: string | undefined;
  try {
    const payload = await response.json() as { error?: string };
    serviceError = payload?.error;
  } catch {
    serviceError = undefined;
  }

  return await buildLocalFallbackStatus(authUserId, serviceError);
}
