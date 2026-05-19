import { isSupportedSalesChannel } from "@/lib/profit-pricing/utils";
import type { ReturnRiskPredictionInput, ReturnRiskValidationResult } from "./types";

function finite(value: number | null | undefined) {
  return Number.isFinite(value) ? Number(value) : null;
}

export function validateReturnRiskPredictionInput(
  input: Partial<ReturnRiskPredictionInput>
): ReturnRiskValidationResult {
  const errors: string[] = [];

  if (!input.productId || String(input.productId).trim().length === 0) {
    errors.push("productId gerekli.");
  }

  if (!input.channel || !isSupportedSalesChannel(String(input.channel))) {
    errors.push("Gecerli bir kanal gerekli.");
  }

  const price = finite(input.price);
  if (price === null || price <= 0) {
    errors.push("Fiyat 0'dan buyuk olmali.");
  }

  if (input.shippingCost !== undefined && finite(input.shippingCost) !== null && Number(input.shippingCost) < 0) {
    errors.push("Kargo maliyeti negatif olamaz.");
  }

  if (input.packagingCost !== undefined && finite(input.packagingCost) !== null && Number(input.packagingCost) < 0) {
    errors.push("Paketleme maliyeti negatif olamaz.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
