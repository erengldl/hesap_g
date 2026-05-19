const MARKETPLACE_INTEGRATION_TIMEOUT_MS = 15_000;

export function getMarketplaceIntegrationServiceBaseUrl() {
  const marketplaceIntegrationServiceUrl = process.env.MARKETPLACE_INTEGRATION_SERVICE_URL?.trim() || "";
  return marketplaceIntegrationServiceUrl.length > 0
    ? marketplaceIntegrationServiceUrl.replace(/\/+$/, "")
    : null;
}

export function getMarketplaceIntegrationServiceToken() {
  return process.env.MARKETPLACE_INTEGRATION_SERVICE_TOKEN?.trim() || "";
}

export async function proxyMarketplaceIntegrationRequest(path: string, init: RequestInit = {}, timeoutMs = MARKETPLACE_INTEGRATION_TIMEOUT_MS) {
  const baseUrl = getMarketplaceIntegrationServiceBaseUrl();
  if (!baseUrl) {
    return Response.json(
      {
        success: false,
        error: "MARKETPLACE_INTEGRATION_SERVICE_URL is not configured.",
      },
      { status: 503 }
    );
  }

  const serviceToken = getMarketplaceIntegrationServiceToken();
  if (!serviceToken) {
    return Response.json(
      {
        success: false,
        error: "MARKETPLACE_INTEGRATION_SERVICE_TOKEN is not configured.",
      },
      { status: 503 }
    );
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    headers.set("Accept", "application/json");
    headers.set("x-marketplace-service-token", serviceToken);

    const response = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });

    const payloadText = await response.text();
    const trimmedText = payloadText.trim();
    const contentType = response.headers.get("content-type") ?? "";

    if (!trimmedText) {
      return Response.json({}, { status: response.status });
    }

    if (contentType.includes("application/json")) {
      return new Response(payloadText, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
        },
      });
    }

    try {
      return Response.json(JSON.parse(payloadText), { status: response.status });
    } catch {
      return Response.json(
        {
          success: false,
          error: trimmedText,
          status: response.status,
        },
        { status: response.status }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        success: false,
        error: `Marketplace integration service proxy failed: ${message}`,
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
