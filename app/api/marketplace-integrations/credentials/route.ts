import { NextResponse } from "next/server";
import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const body = await request.text();
  return proxyMarketplaceIntegrationRequest("/api/v1/integrations/credentials", {
    method: "PUT",
    body,
  });
}
