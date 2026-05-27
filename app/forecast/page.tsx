import ForecastPageClient from "@/components/forecast/ForecastPageClient";
import type { ForecastHorizon } from "@/lib/demand-forecast-types";

type ForecastPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readNumberParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readHorizonParam(value: string | string[] | undefined): ForecastHorizon | undefined {
  const parsed = readNumberParam(value);
  if (parsed === 7 || parsed === 14 || parsed === 30) {
    return parsed;
  }
  return undefined;
}

export default async function ForecastPage({ searchParams }: ForecastPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};

  return (
    <ForecastPageClient
      initialProductId={readNumberParam(resolvedSearchParams.productId)}
      initialMarketplaceId={readNumberParam(resolvedSearchParams.marketplaceId)}
      initialHorizonDays={readHorizonParam(resolvedSearchParams.horizonDays)}
    />
  );
}
