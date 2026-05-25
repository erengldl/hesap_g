export const SEED_DEMO_WARNING_MESSAGE =
  "Bu işlem mevcut tüm ürün ve sipariş verilerini SİLİP yerine demo veri yazar.";

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
