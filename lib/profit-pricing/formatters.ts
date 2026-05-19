import { formatCurrency, formatNumber, formatPercent } from "@/lib/formatters";

export function formatProfitPricingCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Hesaplanamaz";
  }

  return formatCurrency(value);
}

export function formatProfitPricingPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Hesaplanamaz";
  }

  return formatPercent(value * 100);
}

export function formatProfitPricingNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Henüz yok";
  }

  return formatNumber(value);
}

