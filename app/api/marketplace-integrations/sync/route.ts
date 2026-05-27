import { NextResponse } from "next/server";
import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;
  const authUserId = session.authUserId?.trim() || "";
  if (!authUserId) {
    return NextResponse.json({ success: false, error: "Oturum kullanıcı kimliği alınamadı." }, { status: 500 });
  }

  const body = await request.text();
  return proxyMarketplaceIntegrationRequest("/api/v1/integrations/sync", {
    method: "POST",
    body,
  }, undefined, authUserId);
}
