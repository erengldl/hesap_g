import type { ProfitPricingInput, ProfitPricingValidationResult } from "./types";
import { isSupportedSalesChannel, toFiniteNumber } from "./utils";

function hasValue(value: string | number | undefined) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return Number.isFinite(value);
}

export function validateProfitPricingInput(input: ProfitPricingInput): ProfitPricingValidationResult {
  const errors: string[] = [];
  const missingFields: string[] = [];
  const assumptions: string[] = [];
  const warnings: string[] = [];

  if (!isSupportedSalesChannel(input.channel)) {
    errors.push("Geçersiz satış kanalı.");
  }

  if (!hasValue(input.productCost)) {
    missingFields.push("Ürün maliyeti eksik.");
  } else if (toFiniteNumber(input.productCost) < 0) {
    errors.push("Ürün maliyeti negatif olamaz.");
  }

  if (!hasValue(input.salePrice)) {
    missingFields.push("Satış fiyatı eksik.");
  } else if (toFiniteNumber(input.salePrice) <= 0) {
    missingFields.push("Satış fiyatı 0'dan büyük olmalı.");
  }

  const nonNegativeFields: Array<[label: string, number | undefined]> = [
    ["Paketleme maliyeti", input.packagingCost],
    ["Kargo maliyeti", input.shippingCost],
    ["Platform sabit bedeli", input.platformFee],
    ["Sipariş başı reklam maliyeti", input.adCostPerOrder],
    ["Buybox fiyatı", input.buyboxPrice],
    ["İade başı maliyet", input.returnCostPerOrder],
    ["İade/fire risk maliyeti", input.returnRiskCost],
    ["Sabit gider payı", input.fixedCostShare],
    ["Baz talep", input.baseDemand],
    ["Stok limiti", input.stockLimit],
  ];

  for (const [label, value] of nonNegativeFields) {
    if (value !== undefined && toFiniteNumber(value) < 0) {
      errors.push(`${label} negatif olamaz.`);
    }
  }

  const rateFields: Array<[label: string, number | undefined]> = [
    ["Komisyon oranı", input.commissionRate],
    ["İade oranı", input.returnRate],
    ["KDV oranı", input.vatRate],
    ["Stopaj oranı", input.withholdingRate],
    ["Gelir vergisi oranı", input.incomeTaxRate],
    ["Sağlıklı marj hedefi", input.targetMargin],
  ];

  for (const [label, value] of rateFields) {
    if (value !== undefined && (toFiniteNumber(value) < 0 || toFiniteNumber(value) > 1)) {
      errors.push(`${label} 0 ile 1 arasında olmalı.`);
    }
  }

  if (input.basePrice !== undefined && toFiniteNumber(input.basePrice) <= 0) {
    errors.push("Baz fiyat 0'dan büyük olmalı.");
  }

  if (input.buyboxPrice !== undefined && toFiniteNumber(input.buyboxPrice) <= 0) {
    errors.push("Buybox fiyatı 0'dan büyük olmalı.");
  }

  if (input.demandElasticity !== undefined && toFiniteNumber(input.demandElasticity) > 0) {
    warnings.push("Talep elastikiyeti pozitif görünüyor. Bu, fiyat arttıkça talebin artacağı varsayımı demektir.");
  }

  if (input.packagingCost === undefined) {
    assumptions.push("Paketleme maliyeti 0 kabul edildi.");
  }

  if (input.shippingCost === undefined) {
    assumptions.push("Kargo maliyeti 0 kabul edildi.");
  }

  if (input.commissionRate === undefined && input.channel !== "website") {
    assumptions.push("Komisyon oranı 0 kabul edildi.");
  }

  if (input.platformFee === undefined && input.channel !== "website") {
    assumptions.push("Platform bedeli 0 kabul edildi.");
  }

  if (input.adCostPerOrder === undefined) {
    assumptions.push("Reklam maliyeti reklam modülünden çekilemedi. Hesaplama 0 ile devam etti.");
  }

  if (input.returnRiskCost === undefined) {
    assumptions.push("İade/fire maliyeti tahmini hesaplandı. Ürün geçmiş verisi sınırlı.");
  }

  if (input.fixedCostShare === undefined) {
    assumptions.push("Sabit gider payı 0 kabul edildi.");
  }

  if (input.vatRate === undefined) {
    assumptions.push("KDV oranı 0 kabul edildi.");
  }

  if (input.withholdingRate === undefined) {
    assumptions.push("Stopaj oranı %1 kabul edildi.");
  }

  if (input.incomeTaxRate === undefined) {
    assumptions.push("Gelir vergisi oranı 0 kabul edildi.");
  }

  if (input.buyboxPrice === undefined) {
    assumptions.push("Buybox fiyatı girilmedi. Öneri kârlılık ve talep verisine göre üretildi.");
  }

  if (input.targetMargin === undefined) {
    assumptions.push("Sağlıklı marj hedefi %15 kabul edildi.");
  }

  const hasBlockingMissingData = missingFields.some((item) => item.includes("Ürün maliyeti") || item.includes("Satış fiyatı"));

  return {
    ok: errors.length === 0,
    errors,
    missingFields,
    assumptions,
    warnings,
    hasBlockingMissingData,
  };
}
