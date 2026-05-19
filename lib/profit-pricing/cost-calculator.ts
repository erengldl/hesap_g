import type { CostBreakdownItem, CostCalculationResult, ProfitPricingInput } from "./types";
import { predictReturnRiskForProfitPricing } from "@/lib/return-risk/predictor";
import { roundCurrency, safeDivide, toFiniteNumber } from "./utils";

const SHIPPING_VAT_RATE = 0.2;
const DEFAULT_WITHHOLDING_RATE = 0.01;

function resolveReturnRiskCost(input: ProfitPricingInput, price: number) {
  if (input.returnRiskCost !== undefined && Number.isFinite(input.returnRiskCost)) {
    return roundCurrency(input.returnRiskCost);
  }

  return predictReturnRiskForProfitPricing(input, price).expectedReturnRiskCost;
}

export function calculateNetCostAtPrice(
  input: ProfitPricingInput,
  price: number,
  options?: {
    includeAdCost?: boolean;
  }
): CostCalculationResult {
  const safePrice = roundCurrency(Math.max(0, toFiniteNumber(price, 0)));
  const commissionRate = toFiniteNumber(input.commissionRate, 0);
  const platformFee = toFiniteNumber(input.platformFee, 0);
  const adCost = options?.includeAdCost === false ? 0 : toFiniteNumber(input.adCostPerOrder, 0);
  const fixedCostShare = toFiniteNumber(input.fixedCostShare, 0);
  const vatRate = toFiniteNumber(input.vatRate, 0);
  const withholdingRate = toFiniteNumber(input.withholdingRate, DEFAULT_WITHHOLDING_RATE);
  const incomeTaxRate = toFiniteNumber(input.incomeTaxRate, 0);
  const shippingCost = roundCurrency(toFiniteNumber(input.shippingCost, 0));

  const componentsBase = {
    productCost: roundCurrency(toFiniteNumber(input.productCost, 0)),
    packagingCost: roundCurrency(toFiniteNumber(input.packagingCost, 0)),
    shippingCost,
    shippingVat: roundCurrency(shippingCost * SHIPPING_VAT_RATE),
    commission: roundCurrency(safePrice * commissionRate),
    platformFee: roundCurrency(platformFee),
    adCost: roundCurrency(adCost),
    returnRiskCost: resolveReturnRiskCost(input, safePrice),
    fixedCostShare: roundCurrency(fixedCostShare),
    vat: roundCurrency(safePrice * vatRate),
    withholding: roundCurrency(safePrice * withholdingRate),
  };

  const subtotalBeforeIncomeTax = roundCurrency(
    componentsBase.productCost +
      componentsBase.packagingCost +
      componentsBase.shippingCost +
      componentsBase.shippingVat +
      componentsBase.commission +
      componentsBase.platformFee +
      componentsBase.adCost +
      componentsBase.returnRiskCost +
      componentsBase.fixedCostShare +
      componentsBase.vat +
      componentsBase.withholding
  );

  const taxableProfitBeforeIncomeTax = roundCurrency(Math.max(0, safePrice - subtotalBeforeIncomeTax));
  const incomeTax = roundCurrency(taxableProfitBeforeIncomeTax * incomeTaxRate);
  const total = roundCurrency(subtotalBeforeIncomeTax + incomeTax);
  const netProfit = roundCurrency(safePrice - total);
  const profitMargin = safePrice > 0 ? safeDivide(netProfit, safePrice) : null;

  return {
    price: safePrice,
    components: {
      ...componentsBase,
      incomeTax,
    },
    subtotalBeforeIncomeTax,
    total,
    netProfit,
    profitMargin,
  };
}

export function buildCostBreakdown(input: ProfitPricingInput, price: number): CostBreakdownItem[] {
  const calculation = calculateNetCostAtPrice(input, price);
  const items: Array<Omit<CostBreakdownItem, "percentageOfSalePrice">> = [
    {
      key: "product_cost",
      label: "Ürün maliyeti",
      group: "product",
      amount: calculation.components.productCost,
      isVariableWithPrice: false,
      formula: "C_product",
      description: "Ürünün temel tedarik maliyeti.",
    },
    {
      key: "packaging_cost",
      label: "Paketleme",
      group: "product",
      amount: calculation.components.packagingCost,
      isVariableWithPrice: false,
      formula: "C_packaging",
      description: "Sipariş başına paketleme maliyeti.",
    },
    {
      key: "shipping_cost",
      label: "Kargo",
      group: "operation",
      amount: calculation.components.shippingCost,
      isVariableWithPrice: false,
      formula: "C_shipping",
      description: "Sipariş başına kargo etkisi.",
    },
    {
      key: "shipping_vat",
      label: "Kargo KDV",
      group: "operation",
      amount: calculation.components.shippingVat,
      isVariableWithPrice: false,
      formula: "Kargo maliyeti × %20",
      description: "Kargo maliyeti üzerinden hesaplanan KDV etkisi.",
    },
    {
      key: "commission",
      label: "Komisyon",
      group: "channel",
      amount: calculation.components.commission,
      isVariableWithPrice: toFiniteNumber(input.commissionRate, 0) > 0,
      formula: "Satış fiyatı × komisyon oranı",
      description: "Kanal komisyonu fiyat arttıkça yeniden hesaplanır.",
    },
    {
      key: "platform_fee",
      label: "Platform bedeli",
      group: "channel",
      amount: calculation.components.platformFee,
      isVariableWithPrice: false,
      formula: "C_platform",
      description: "Platform hizmet bedeli sabit maliyet olarak uygulanır.",
    },
    {
      key: "ad_cost",
      label: "Reklam maliyeti",
      group: "growth",
      amount: calculation.components.adCost,
      isVariableWithPrice: false,
      formula: "C_ads",
      description: "Sipariş başına reklam maliyeti.",
    },
    {
      key: "return_impact",
      label: "İade/fire riski",
      group: "operation",
      amount: calculation.components.returnRiskCost,
      isVariableWithPrice: input.returnRiskCost === undefined,
      formula: "ML_Return_Risk_Cost(product, channel, price, demand, history)",
      description: "ML/risk motoru değeri yoksa iade oranı ve iade başı maliyetle tahmin edilir.",
    },
    {
      key: "fixed_cost_share",
      label: "Sabit gider payı",
      group: "fixed",
      amount: calculation.components.fixedCostShare,
      isVariableWithPrice: false,
      formula: "C_overhead",
      description: "Sipariş başına dağıtılan sabit gider payı.",
    },
    {
      key: "vat",
      label: "KDV",
      group: "tax",
      amount: calculation.components.vat,
      isVariableWithPrice: toFiniteNumber(input.vatRate, 0) > 0,
      formula: "Satış fiyatı × KDV oranı",
      description: "Satış fiyatına bağlı KDV maliyet etkisi.",
    },
    {
      key: "withholding",
      label: "Stopaj",
      group: "tax",
      amount: calculation.components.withholding,
      isVariableWithPrice: toFiniteNumber(input.withholdingRate, DEFAULT_WITHHOLDING_RATE) > 0,
      formula: "Satış fiyatı × stopaj oranı",
      description: "V1 varsayılan stopaj oranı %1 olarak uygulanır.",
    },
    {
      key: "income_tax",
      label: "Gelir vergisi etkisi",
      group: "tax",
      amount: calculation.components.incomeTax,
      isVariableWithPrice: toFiniteNumber(input.incomeTaxRate, 0) > 0,
      formula: "max(0, gelir vergisi öncesi kâr × gelir vergisi oranı)",
      description: "Zarar yoksa kâr üzerinden uygulanan tahmini vergi etkisi.",
    },
  ];

  return items
    .filter((item) => item.amount > 0)
    .map((item) => ({
      ...item,
      percentageOfSalePrice: price > 0 ? safeDivide(item.amount, price) : null,
    }));
}

function solvePriceForMargin(input: ProfitPricingInput, targetMargin: number) {
  const currentPrice = Math.max(1, toFiniteNumber(input.salePrice, 1));
  let low = 0.01;
  let high = Math.max(currentPrice * 1.25, toFiniteNumber(input.productCost, 0) * 2 + 100);

  const evaluate = (price: number) => calculateNetCostAtPrice(input, price).profitMargin ?? -1;

  let highMargin = evaluate(high);
  let attempts = 0;
  while (highMargin < targetMargin && high < 1_000_000 && attempts < 24) {
    high *= 1.5;
    highMargin = evaluate(high);
    attempts += 1;
  }

  if (highMargin < targetMargin) {
    return null;
  }

  for (let index = 0; index < 60; index += 1) {
    const mid = (low + high) / 2;
    const margin = evaluate(mid);
    if (margin >= targetMargin) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return roundCurrency(high);
}

export function solveBreakEvenPrice(input: ProfitPricingInput) {
  return solvePriceForMargin(input, 0) ?? roundCurrency(Math.max(0, input.salePrice));
}

export function solveTargetMarginPrice(input: ProfitPricingInput) {
  const targetMargin = toFiniteNumber(input.targetMargin, 0.15);
  if (targetMargin <= 0) {
    return solveBreakEvenPrice(input);
  }

  return solvePriceForMargin(input, targetMargin);
}

export function solveMinimumHealthyPrice(input: ProfitPricingInput, minimumHealthyMargin: number) {
  return solvePriceForMargin(input, minimumHealthyMargin);
}

export function calculateMaxProfitableAdCost(input: ProfitPricingInput) {
  const withoutAd = calculateNetCostAtPrice(input, input.salePrice, { includeAdCost: false });
  return roundCurrency(Math.max(0, input.salePrice - withoutAd.total));
}
