import type { SalesChannel } from "@/lib/profit-pricing/types";

export type ReturnRiskConfidence = "high" | "medium" | "low";

export type ReturnRiskModelType = "typescript-logistic-regression";

export interface ReturnRiskStatsSlice {
  orderCount: number;
  returnedCount: number;
  returnRate: number;
}

export interface ReturnRiskStats {
  product: ReturnRiskStatsSlice;
  category: ReturnRiskStatsSlice;
  channel: ReturnRiskStatsSlice;
  global: ReturnRiskStatsSlice;
  productAveragePrice: number | null;
  categoryAveragePrice: number | null;
  expectedCostIfReturned: number | null;
}

export interface ReturnRiskContext {
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  productAgeDays?: number;
  variantCount?: number;
  stockLevel?: number;
  currentPrice?: number;
  historicalAveragePrice?: number;
  categoryAveragePrice?: number;
  discountAmount?: number;
  campaignFlag?: boolean;
  adAttributedFlag?: boolean;
  forecastedDemand?: number | null;
  demandConfidence?: number | null;
  stockRiskScore?: number | null;
  stats?: Partial<ReturnRiskStats>;
  generatedAt?: string;
  source?: "data_center" | "manual" | "fallback";
}

export interface ReturnRiskPredictionInput {
  productId: string;
  channel: SalesChannel;
  price: number;
  productCost?: number;
  packagingCost?: number;
  shippingCost?: number;
  commissionRate?: number;
  platformFee?: number;
  basePrice?: number;
  baseDemand?: number;
  demandForecast?: number | null;
  stockLimit?: number;
  context?: ReturnRiskContext;
  modelArtifact?: ReturnRiskModelArtifact | null;
}

export interface ReturnRiskTrainingRow {
  orderId: string;
  productId: string;
  channel: SalesChannel;
  orderDate: string;
  salePrice: number;
  quantity: number;
  discountAmount?: number;
  campaignFlag?: boolean;
  adAttributedFlag?: boolean;
  isReturnedOrLost: boolean;
  categoryId?: string;
  categoryName?: string;
  brand?: string;
  productCost?: number;
  packagingCost?: number;
  shippingCost?: number;
  commissionRate?: number;
  platformFee?: number;
  stock?: number;
  productAgeDays?: number;
  variantCount?: number;
  historicalAveragePrice?: number;
  categoryAveragePrice?: number;
  demandForecast?: number;
  demandConfidence?: number;
  stockRiskScore?: number;
}

export interface ReturnRiskFeatureVector {
  values: Record<string, number>;
  missingValueCount: number;
  stats: ReturnRiskStats;
  expectedCostIfReturned: number;
}

export interface ReturnRiskClassBalanceMetrics {
  positiveRate: number;
  negativeRate: number;
  imbalanceRatio: number;
  positiveClassWeight: number;
  majorityClassBaseline: number;
}

export interface ReturnRiskCalibrationBucket {
  bucket: string;
  minProbability: number;
  maxProbability: number;
  count: number;
  averagePredictedProbability: number;
  observedReturnRate: number;
}

export interface ReturnRiskEvaluationMetrics {
  rocAuc: number;
  prAuc: number;
  precision: number;
  recall: number;
  f1: number;
  brierScore: number;
  averagePredictedReturnCost: number;
  classBalance: ReturnRiskClassBalanceMetrics;
  calibrationBuckets: ReturnRiskCalibrationBucket[];
  trainingRows: number;
  positiveRows: number;
}

export interface ReturnRiskModelArtifact {
  modelVersion: string;
  modelType: ReturnRiskModelType;
  trainedAt: string;
  featureNames: string[];
  weights: number[];
  bias: number;
  means: Record<string, number>;
  scales: Record<string, number>;
  stats: ReturnRiskStats;
  metrics: ReturnRiskEvaluationMetrics;
  trainingRows: number;
  positiveRows: number;
}

export interface ReturnRiskTrainingResult {
  ok: boolean;
  modelVersion: string | null;
  modelType: ReturnRiskModelType;
  trainingRows: number;
  positiveRows: number;
  metrics: ReturnRiskEvaluationMetrics | null;
  reason?: string;
}

export interface ReturnRiskPrediction {
  productId: string;
  channel: SalesChannel;
  price: number;
  returnProbability: number;
  expectedCostIfReturned: number;
  expectedReturnRiskCost: number;
  confidence: ReturnRiskConfidence;
  modelVersion: string;
  modelType: string;
  usedFallback: boolean;
  topRiskFactors: string[];
  explanation: string;
}

export interface ReturnRiskValidationResult {
  ok: boolean;
  errors: string[];
}
