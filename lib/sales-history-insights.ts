export type SalesHistoryTrendPoint = {
  date: string;
  orders: number;
  units: number;
  revenue: number;
  marketplace: string | null;
  missing: boolean;
};

export type SalesHistoryQualityLabel = "Yeterli Veri" | "Sınırlı Veri" | "Eksik Veri";
export type SalesHistoryQualityTone = "profit" | "warning" | "loss";

export type SalesHistoryDataQuality = {
  label: SalesHistoryQualityLabel;
  tone: SalesHistoryQualityTone;
  summary: string;
  forecast_readiness: string;
  active_sales_days: number;
  missing_days: number;
  total_days: number;
  completeness_ratio: number;
  last_order_date: string | null;
  notes: string[];
};

type AssessSalesHistoryQualityInput = {
  trend: SalesHistoryTrendPoint[];
  totalOrders: number;
  totalUnits: number;
  activeMarketplaces: number;
};

function roundRatio(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function assessSalesHistoryQuality({
  trend,
  totalOrders,
  totalUnits,
  activeMarketplaces,
}: AssessSalesHistoryQualityInput): SalesHistoryDataQuality {
  const totalDays = trend.length;
  const activeSalesDays = trend.filter((point) => !point.missing && point.orders > 0).length;
  const missingDays = Math.max(totalDays - activeSalesDays, 0);
  const completenessRatio = roundRatio(totalDays > 0 ? activeSalesDays / totalDays : 0);
  const lastOrderDate = [...trend].reverse().find((point) => point.orders > 0)?.date ?? null;

  const baseNotes = [
    `${activeSalesDays}/${totalDays} günde satış hareketi var.`,
    `${missingDays} gün satış görünmüyor.`,
    `${activeMarketplaces} kanal satış sinyali üretiyor.`,
  ];

  if (totalOrders === 0 || activeSalesDays < 7 || completenessRatio < 0.18) {
    return {
      label: "Eksik Veri",
      tone: "loss",
      summary: "Satış geçmişi talep tahmini ve stok riski için zayıf. Model güvenilir sinyal üretmekte zorlanır.",
      forecast_readiness: "Forecast çalıştırmadan önce yeni sipariş verisi içe aktarın veya daha geniş bir dönem seçin.",
      active_sales_days: activeSalesDays,
      missing_days: missingDays,
      total_days: totalDays,
      completeness_ratio: completenessRatio,
      last_order_date: lastOrderDate,
      notes: [...baseNotes, "Kısa dönem stok ve talep kararları yüksek hata riski taşır."],
    };
  }

  if (totalOrders < 30 || activeSalesDays < 21 || completenessRatio < 0.45) {
    return {
      label: "Sınırlı Veri",
      tone: "warning",
      summary: "Satış geçmişi kullanılabilir ama model güveni orta seviyede kalır. Kısa dönem tahminler tercih edilmelidir.",
      forecast_readiness: "Forecast üretilebilir; ancak güvenli karar için veri kapsamını ve kanal sürekliliğini artırın.",
      active_sales_days: activeSalesDays,
      missing_days: missingDays,
      total_days: totalDays,
      completeness_ratio: completenessRatio,
      last_order_date: lastOrderDate,
      notes: [...baseNotes, "Promosyon veya kampanya etkileri tahmini kolayca bozabilir."],
    };
  }

  return {
    label: "Yeterli Veri",
    tone: "profit",
    summary: "Satış geçmişi tahmin modeli için yeterli kapsama sağlıyor. Stok riski ve ürün hızı sinyalleri daha güvenilir okunabilir.",
    forecast_readiness: "Forecast ve stok planlama için veri hazır görünüyor.",
    active_sales_days: activeSalesDays,
    missing_days: missingDays,
    total_days: totalDays,
    completeness_ratio: completenessRatio,
    last_order_date: lastOrderDate,
    notes: [...baseNotes, `${totalUnits} adetlik hareket ürün hızını okumak için yeterli taban oluşturuyor.`],
  };
}
