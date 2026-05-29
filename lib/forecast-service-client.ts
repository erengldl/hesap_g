import { buildDemandForecastBootstrap, generateDemandForecast } from "./demand-forecast";
import type {
  DemandForecastBootstrapResponse,
  DemandForecastRequest,
  DemandForecastResult,
  DemandForecastRunResponse,
  ForecastHorizon,
} from "./demand-forecast-types";

const FORECAST_SERVICE_URL = process.env.FORECAST_SERVICE_URL?.trim() || "";
const FORECAST_SERVICE_TIMEOUT_MS = 1200;

function getForecastServiceBaseUrl() {
  return FORECAST_SERVICE_URL.length > 0 ? FORECAST_SERVICE_URL.replace(/\/+$/, "") : null;
}

function buildServiceUrl(path: string, searchParams?: URLSearchParams) {
  const baseUrl = getForecastServiceBaseUrl();
  if (!baseUrl) return null;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (searchParams) {
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

function toSearchParams(input: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FORECAST_SERVICE_TIMEOUT_MS);

  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[forecast-service] proxy failed for ${url}: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getForecastBootstrapData(input: {
  productId?: number;
  marketplaceId?: number;
  horizonDays?: ForecastHorizon;
} = {}): Promise<DemandForecastBootstrapResponse & { success: true }> {
  const params = toSearchParams({
    productId: input.productId,
    marketplaceId: input.marketplaceId,
    horizonDays: input.horizonDays && input.horizonDays !== 14 ? input.horizonDays : undefined,
  });

  const url = buildServiceUrl("/api/v1/forecast/generate", params);
  if (url) {
    const remote = await fetchJsonWithTimeout<DemandForecastBootstrapResponse & { success?: boolean }>(url, {
      method: "GET",
    });

    if (remote && remote.success !== false) {
      return { ...remote, success: true };
    }
  }

  return {
    ...buildDemandForecastBootstrap(input.productId, input.marketplaceId, input.horizonDays ?? 14),
    success: true,
  };
}

export async function runDemandForecastData(input: Partial<DemandForecastRequest> = {}): Promise<DemandForecastRunResponse> {
  const url = buildServiceUrl("/api/v1/forecast/generate");
  if (url) {
    const remote = await fetchJsonWithTimeout<DemandForecastRunResponse>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (remote?.success) {
      return remote;
    }
  }

  const result: DemandForecastResult = generateDemandForecast(input);
  return {
    success: true,
    result,
    savedRows: result.tableRows.length,
    warnings: result.warnings,
  };
}
