import type {
  PriceGridPoint,
  ProfitPricingResult,
  SalesChannel,
} from "./types";
import { channelLabel, roundCurrency } from "./utils";

export const OPTIMIZATION_STRATEGY_KEYS = [
  "high_sales",
  "buybox_balance",
  "premium_balance",
] as const;

export type OptimizationStrategyKey =
  (typeof OPTIMIZATION_STRATEGY_KEYS)[number];

export type OptimizationStrategyChannelTarget = {
  channel: SalesChannel;
  label: string;
  price: number | null;
  demand: number | null;
  totalProfit: number | null;
  note?: string;
};

export type OptimizationStrategySuggestion = {
  key: OptimizationStrategyKey;
  label: string;
  subtitle: string;
  description: string;
  disabled: boolean;
  selectedChannelPrice: number | null;
  selectedChannelDemand: number | null;
  selectedChannelTotalProfit: number | null;
  selectedChannelNote?: string;
  channelTargets: OptimizationStrategyChannelTarget[];
};

type StrategyPoint = Pick<
  PriceGridPoint,
  "price" | "netProfit" | "estimatedDemand" | "estimatedTotalProfit" | "profitMargin"
>;

function getPoints(result: ProfitPricingResult): StrategyPoint[] {
  const source = result.priceGrid.length > 0 ? result.priceGrid : result.priceScenarios;
  return source.map((point) => ({
    price: point.price,
    netProfit: point.netProfit,
    estimatedDemand: point.estimatedDemand ?? null,
    estimatedTotalProfit: point.estimatedTotalProfit ?? null,
    profitMargin: point.profitMargin ?? null,
  }));
}

function compareNumbers(a: number | null | undefined, b: number | null | undefined) {
  const safeA = typeof a === "number" && Number.isFinite(a) ? a : Number.NEGATIVE_INFINITY;
  const safeB = typeof b === "number" && Number.isFinite(b) ? b : Number.NEGATIVE_INFINITY;
  return safeB - safeA;
}

function isPositiveProfit(point: StrategyPoint) {
  return Number.isFinite(point.netProfit) && point.netProfit > 0;
}

function selectHighSalesPoint(result: ProfitPricingResult) {
  const profitable = getPoints(result).filter(isPositiveProfit);
  if (profitable.length === 0) {
    return null;
  }

  return [...profitable].sort((left, right) => {
    const demandOrder = compareNumbers(left.estimatedDemand, right.estimatedDemand);
    if (demandOrder !== 0) {
      return demandOrder;
    }

    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return compareNumbers(left.estimatedTotalProfit, right.estimatedTotalProfit);
  })[0];
}

function selectBuyboxBalancePoint(result: ProfitPricingResult) {
  const buyboxPrice = result.input.buyboxPrice;
  const buybox: number | null =
    typeof buyboxPrice === "number" && Number.isFinite(buyboxPrice)
      ? buyboxPrice
      : null;
  if (buybox === null || buybox <= 0) {
    return null;
  }

  const candidates = getPoints(result).filter(
    (point) => isPositiveProfit(point) && point.price <= buybox
  );
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const totalProfitOrder = compareNumbers(
      left.estimatedTotalProfit,
      right.estimatedTotalProfit
    );
    if (totalProfitOrder !== 0) {
      return totalProfitOrder;
    }

    const demandOrder = compareNumbers(left.estimatedDemand, right.estimatedDemand);
    if (demandOrder !== 0) {
      return demandOrder;
    }

    return right.price - left.price;
  })[0];
}

function selectPremiumPoint(result: ProfitPricingResult) {
  const candidates = getPoints(result).filter(isPositiveProfit);
  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const totalProfitOrder = compareNumbers(
      left.estimatedTotalProfit,
      right.estimatedTotalProfit
    );
    if (totalProfitOrder !== 0) {
      return totalProfitOrder;
    }

    if (left.netProfit !== right.netProfit) {
      return right.netProfit - left.netProfit;
    }

    return right.price - left.price;
  })[0];
}

export function selectStrategyPoint(
  result: ProfitPricingResult,
  strategy: OptimizationStrategyKey
) {
  switch (strategy) {
    case "high_sales":
      return selectHighSalesPoint(result);
    case "buybox_balance":
      return selectBuyboxBalancePoint(result);
    case "premium_balance":
      return selectPremiumPoint(result);
    default:
      return null;
  }
}

function getStrategyMeta(strategy: OptimizationStrategyKey) {
  switch (strategy) {
    case "high_sales":
      return {
        label: "Düşük kâr, yüksek satış",
        subtitle: "Daha hızlı dönüş için düşük marj",
        description:
          "Pozitif kârı koruyup talebi en yüksek seviyede tutan fiyat seçilir.",
      };
    case "buybox_balance":
      return {
        label: "Buybox altı denge",
        subtitle: "Buybox altında en yüksek toplam kâr",
        description:
          "Buybox seviyesini aşmadan toplam kârı en yüksek yapan fiyat seçilir.",
      };
    case "premium_balance":
      return {
        label: "Tok satıcı fiyatı",
        subtitle: "Buybox üstü olabilir, kâr odaklı denge",
        description:
          "Buybox dikkate alınmadan toplam kârı maksimize eden daha premium fiyat seçilir.",
      };
    default:
      return {
        label: "Öneri",
        subtitle: "",
        description: "",
      };
  }
}

function buildNote(
  result: ProfitPricingResult,
  strategy: OptimizationStrategyKey,
  point: StrategyPoint | null
) {
  if (!point) {
    return strategy === "buybox_balance"
      ? "Bu kanal için geçerli buybox fiyatı bulunmadı."
      : "Bu kanal için uygulanabilir fiyat bulunamadı.";
  }

  const buyboxPrice = result.input.buyboxPrice;
  const buybox: number | null =
    typeof buyboxPrice === "number" && Number.isFinite(buyboxPrice)
      ? buyboxPrice
      : null;
  if (
    strategy === "premium_balance" &&
    buybox !== null &&
    buybox > 0 &&
    point.price > buybox
  ) {
    return "Buybox üstü fiyat. Talep düşebilir, iade beklentisi artabilir.";
  }

  if (strategy === "high_sales") {
    return "Düşük marj ile sipariş akışını canlı tutmayı hedefler.";
  }

  return undefined;
}

export function buildOptimizationSuggestions(
  resultsByChannel: Partial<Record<SalesChannel, ProfitPricingResult>>,
  selectedChannel: SalesChannel
): OptimizationStrategySuggestion[] {
  const availableChannels = Object.keys(resultsByChannel) as SalesChannel[];
  const orderedChannels = availableChannels.sort((left, right) => {
    const order = ["trendyol", "hepsiburada", "website"];
    return order.indexOf(left) - order.indexOf(right);
  });

  return OPTIMIZATION_STRATEGY_KEYS.map((strategy) => {
    const meta = getStrategyMeta(strategy);
    const channelTargets = orderedChannels.map((channel) => {
      const result = resultsByChannel[channel];
      if (!result) {
        return {
          channel,
          label: channelLabel(channel),
          price: null,
          demand: null,
          totalProfit: null,
          note: "Kanal sonucu bulunamadı.",
        };
      }

      const point = selectStrategyPoint(result, strategy);
      return {
        channel,
        label: channelLabel(channel),
        price: point ? roundCurrency(point.price) : null,
        demand: point?.estimatedDemand ?? null,
        totalProfit: point?.estimatedTotalProfit ?? null,
        note: buildNote(result, strategy, point),
      };
    });

    const selectedTarget =
      channelTargets.find((target) => target.channel === selectedChannel) ??
      channelTargets[0];

    return {
      key: strategy,
      label: meta.label,
      subtitle: meta.subtitle,
      description: meta.description,
      disabled: selectedTarget?.price == null,
      selectedChannelPrice: selectedTarget?.price ?? null,
      selectedChannelDemand: selectedTarget?.demand ?? null,
      selectedChannelTotalProfit: selectedTarget?.totalProfit ?? null,
      selectedChannelNote: selectedTarget?.note,
      channelTargets,
    };
  });
}
