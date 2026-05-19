import { afterEach, describe, expect, it, vi } from "vitest";

import { proxyMarketplaceIntegrationRequest } from "@/lib/marketplace-integration-service";

const originalUrl = process.env.MARKETPLACE_INTEGRATION_SERVICE_URL;
const originalToken = process.env.MARKETPLACE_INTEGRATION_SERVICE_TOKEN;

afterEach(() => {
  process.env.MARKETPLACE_INTEGRATION_SERVICE_URL = originalUrl;
  process.env.MARKETPLACE_INTEGRATION_SERVICE_TOKEN = originalToken;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("proxyMarketplaceIntegrationRequest", () => {
  it("forwards the trusted service token header to the backend", async () => {
    process.env.MARKETPLACE_INTEGRATION_SERVICE_URL = "http://127.0.0.1:8003";
    process.env.MARKETPLACE_INTEGRATION_SERVICE_TOKEN = "test-marketplace-token";

    const fetchMock = vi.fn();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true, marketplaces: [] }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyMarketplaceIntegrationRequest("/api/v1/integrations/status", {
      method: "GET",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [string | URL, RequestInit | undefined];
    expect(String(calledUrl)).toBe("http://127.0.0.1:8003/api/v1/integrations/status");

    const headers = new Headers(calledInit?.headers);
    expect(headers.get("x-marketplace-service-token")).toBe("test-marketplace-token");

    await expect(response.json()).resolves.toEqual({ success: true, marketplaces: [] });
  });

  it("returns a configuration error when the service token is missing", async () => {
    process.env.MARKETPLACE_INTEGRATION_SERVICE_URL = "http://127.0.0.1:8003";
    delete process.env.MARKETPLACE_INTEGRATION_SERVICE_TOKEN;

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyMarketplaceIntegrationRequest("/api/v1/integrations/status", {
      method: "GET",
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: "MARKETPLACE_INTEGRATION_SERVICE_TOKEN is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
