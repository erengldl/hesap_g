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

  try {
    const [bootstrap, results] = await Promise.all([
      buildCostBootstrap(productId),
      recalculateCostResultsForProductFromDatabase(productId),
    ]);

    return {
      bootstrap,
      results,
      error: null as string | null,
      selectedProductId: productId ?? bootstrap.selectedProduct?.id,
    };
  } catch (error) {
    console.error("Net cost page bootstrap error:", error);
    return {
      bootstrap: null,
      results: null,
      error: "Net maliyet ekranı hazırlanamadı. Veri kaynağına erişim tekrar denenmeli.",
      selectedProductId: productId,
    };
  }
}

export default async function NetCostPage(props: {
  searchParams?: Promise<SearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { bootstrap, results, error, selectedProductId } = await resolveNetCostBootstrap(searchParams);

  return (
    <NetCostWorkspace
      bootstrap={bootstrap}
      results={results}
      selectedProductId={selectedProductId}
      error={error}
    />
  );
}
