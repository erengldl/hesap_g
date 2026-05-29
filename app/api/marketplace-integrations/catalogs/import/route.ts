import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  return proxyMarketplaceIntegrationRequest(
    "/api/v1/integrations/catalogs/import",
    {
      method: "POST",
      body,
    },
    180_000
  );
}
