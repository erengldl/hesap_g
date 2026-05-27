export const SEED_DEMO_WARNING_MESSAGE =
  "Bu işlem yalnızca mevcut çalışma alanınızdaki ürün ve sipariş verilerini demo veriyle yeniler.";

export type SeedDemoResponse = {
  success: boolean;
  productsInserted: number;
  productsSkipped: number;
  settingsInserted: number;
  ordersInserted?: number;
  orderItemsInserted?: number;
  inventoryRowsInserted?: number;
  message: string;
  warning: string;
};

export function buildSeedDemoSuccessMessage(summary: string) {
  const trimmedSummary = summary.trim();

  if (!trimmedSummary) {
    return SEED_DEMO_WARNING_MESSAGE;
  }

  if (trimmedSummary.includes(SEED_DEMO_WARNING_MESSAGE)) {
    return trimmedSummary;
  }

  return `${SEED_DEMO_WARNING_MESSAGE} ${trimmedSummary}`;
}
