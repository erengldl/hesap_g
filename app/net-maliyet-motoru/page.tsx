import { buildCostBootstrap, recalculateCostResultsForProductFromDatabase } from "@/lib/cost-engine";
import NetCostWorkspace from "@/components/profit-pricing/NetCostWorkspace";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function readFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseProductId(value: string | undefined) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
}

async function resolveNetCostBootstrap(searchParams: SearchParams) {
  const productId = parseProductId(readFirstValue(searchParams.productId));

  const [bootstrapResult, resultsResult] = await Promise.allSettled([
    buildCostBootstrap(productId),
    recalculateCostResultsForProductFromDatabase(productId),
  ]);

  const bootstrap = bootstrapResult.status === "fulfilled" ? bootstrapResult.value : null;
  const results = resultsResult.status === "fulfilled" ? resultsResult.value : null;

  if (bootstrapResult.status === "rejected" || resultsResult.status === "rejected") {
    console.error("Net cost page bootstrap error:", {
      bootstrap: bootstrapResult.status === "rejected" ? bootstrapResult.reason : null,
      results: resultsResult.status === "rejected" ? resultsResult.reason : null,
    });
  }

  return {
    bootstrap,
    results,
    selectedProductId: productId ?? bootstrap?.selectedProduct?.id,
  };
}

export default async function NetCostPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { bootstrap, results, selectedProductId } = await resolveNetCostBootstrap(searchParams);

  return (
    <NetCostWorkspace
      bootstrap={bootstrap}
      results={results}
      selectedProductId={selectedProductId}
    />
  );
}
