import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = await request.text();
  return proxyMarketplaceIntegrationRequest("/api/v1/integrations/credentials", {
    method: "PUT",
    body,
  });
}
