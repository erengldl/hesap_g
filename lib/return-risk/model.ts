import {
  getReturnRiskFeatureArray,
  RETURN_RISK_FEATURE_NAMES,
} from "./feature-builder";
import type {
  ReturnRiskEvaluationMetrics,
  ReturnRiskFeatureVector,
  ReturnRiskModelArtifact,
  ReturnRiskStats,
  ReturnRiskTrainingRow,
} from "./types";
import { buildReturnRiskStats, buildReturnRiskTrainingExample } from "./feature-builder";

const MODEL_TYPE = "typescript-logistic-regression" as const;
const MIN_TRAINING_ROWS = 300;
const MIN_POSITIVE_ROWS = 30;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number | null | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }

  const z = Math.exp(value);
  return z / (1 + z);
}

function dot(left: number[], right: number[]) {
  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += left[index] * (right[index] ?? 0);
  }
  return total;
}

function mean(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], valueMean: number) {
  if (values.length <= 1) {
    return 1;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - valueMean) ** 2, 0) / values.length;
  const deviation = Math.sqrt(variance);
  return deviation > 0 ? deviation : 1;
}

function buildScaler(matrix: number[][]) {
  const means: Record<string, number> = {};
  const scales: Record<string, number> = {};

  RETURN_RISK_FEATURE_NAMES.forEach((name, featureIndex) => {
    const values = matrix.map((row) => finite(row[featureIndex]));
    const featureMean = mean(values);
    means[name] = featureMean;
    scales[name] = standardDeviation(values, featureMean);
  });

  return { means, scales };
}

function scaleRow(
  row: number[],
  means: Record<string, number>,
  scales: Record<string, number>
) {
  return RETURN_RISK_FEATURE_NAMES.map((name, index) => {
    const scaled = (finite(row[index]) - finite(means[name])) / Math.max(1e-9, finite(scales[name], 1));
    return clamp(scaled, -8, 8);
  });
}

function scoreThreshold(predictions: Array<{ probability: number; label: number }>) {
  if (predictions.length === 0) {
    return { truePositive: 0, falsePositive: 0, falseNegative: 0 };
  }

  return predictions.reduce(
    (accumulator, item) => {
      const predictedPositive = item.probability >= 0.5;
      if (predictedPositive && item.label === 1) accumulator.truePositive += 1;
      if (predictedPositive && item.label === 0) accumulator.falsePositive += 1;
      if (!predictedPositive && item.label === 1) accumulator.falseNegative += 1;
      return accumulator;
    },
    { truePositive: 0, falsePositive: 0, falseNegative: 0 }
  );
}

function calculateRocAuc(predictions: Array<{ probability: number; label: number }>) {
  const positives = predictions.filter((item) => item.label === 1);
  const negatives = predictions.filter((item) => item.label === 0);
  const denominator = positives.length * negatives.length;
  if (denominator === 0) {
    return 0.5;
  }

  let wins = 0;
  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.probability > negative.probability) wins += 1;
      if (positive.probability === negative.probability) wins += 0.5;
    }
  }

  return Math.round((wins / denominator) * 10000) / 10000;
}

function calculatePrAuc(predictions: Array<{ probability: number; label: number }>) {
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const positiveCount = sorted.filter((item) => item.label === 1).length;
  if (positiveCount === 0) {
    return 0;
  }

  let truePositive = 0;
  let falsePositive = 0;
  let previousRecall = 0;
  let area = 0;

  for (const item of sorted) {
    if (item.label === 1) truePositive += 1;
    else falsePositive += 1;

    const recall = truePositive / positiveCount;
    const precision = truePositive / Math.max(1, truePositive + falsePositive);
    area += (recall - previousRecall) * precision;
    previousRecall = recall;
  }

  return Math.round(area * 10000) / 10000;
}

function calculateClassBalance(predictions: Array<{ probability: number; label: number }>) {
  const rowCount = predictions.length;
  const positiveRows = predictions.filter((item) => item.label === 1).length;
  const negativeRows = Math.max(0, rowCount - positiveRows);
  const positiveRate = rowCount > 0 ? positiveRows / rowCount : 0;
  const negativeRate = rowCount > 0 ? negativeRows / rowCount : 0;
  const majorityClassBaseline = rowCount > 0 ? Math.max(positiveRows, negativeRows) / rowCount : 0;

  return {
    positiveRate: Math.round(positiveRate * 10000) / 10000,
    negativeRate: Math.round(negativeRate * 10000) / 10000,
    imbalanceRatio:
      positiveRows > 0 ? Math.round((negativeRows / positiveRows) * 10000) / 10000 : negativeRows,
    positiveClassWeight:
      positiveRows > 0 ? Math.round(Math.min(8, negativeRows / positiveRows) * 10000) / 10000 : 1,
    majorityClassBaseline: Math.round(majorityClassBaseline * 10000) / 10000,
  };
}

function calculateCalibrationBuckets(predictions: Array<{ probability: number; label: number }>) {
  return Array.from({ length: 10 }, (_, index) => {
    const minProbability = index / 10;
    const maxProbability = (index + 1) / 10;
    const items = predictions.filter((item) => {
      if (index === 9) {
        return item.probability >= minProbability && item.probability <= maxProbability;
      }

      return item.probability >= minProbability && item.probability < maxProbability;
    });
    const averagePredictedProbability =
      items.length > 0 ? items.reduce((sum, item) => sum + item.probability, 0) / items.length : 0;
    const observedReturnRate =
      items.length > 0 ? items.reduce((sum, item) => sum + item.label, 0) / items.length : 0;

    return {
      bucket: `${Math.round(minProbability * 100)}-${Math.round(maxProbability * 100)}%`,
      minProbability: Math.round(minProbability * 10000) / 10000,
      maxProbability: Math.round(maxProbability * 10000) / 10000,
      count: items.length,
      averagePredictedProbability: Math.round(averagePredictedProbability * 10000) / 10000,
      observedReturnRate: Math.round(observedReturnRate * 10000) / 10000,
    };
  });
}

export function evaluateReturnRiskPredictions(
  predictions: Array<{ probability: number; label: number; expectedCostIfReturned?: number }>
): ReturnRiskEvaluationMetrics {
  const threshold = scoreThreshold(predictions);
  const precision =
    threshold.truePositive + threshold.falsePositive > 0
      ? threshold.truePositive / (threshold.truePositive + threshold.falsePositive)
      : 0;
  const recall =
    threshold.truePositive + threshold.falseNegative > 0
      ? threshold.truePositive / (threshold.truePositive + threshold.falseNegative)
      : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const brierScore =
    predictions.length > 0
      ? predictions.reduce((sum, item) => sum + (item.probability - item.label) ** 2, 0) /
        predictions.length
      : 0;
  const averagePredictedReturnCost =
    predictions.length > 0
      ? predictions.reduce(
          (sum, item) => sum + item.probability * finite(item.expectedCostIfReturned),
          0
        ) / predictions.length
      : 0;

  return {
    rocAuc: calculateRocAuc(predictions),
    prAuc: calculatePrAuc(predictions),
    precision: Math.round(precision * 10000) / 10000,
    recall: Math.round(recall * 10000) / 10000,
    f1: Math.round(f1 * 10000) / 10000,
    brierScore: Math.round(brierScore * 10000) / 10000,
    averagePredictedReturnCost: Math.round(averagePredictedReturnCost * 100) / 100,
    classBalance: calculateClassBalance(predictions),
    calibrationBuckets: calculateCalibrationBuckets(predictions),
    trainingRows: predictions.length,
    positiveRows: predictions.filter((item) => item.label === 1).length,
  };
}

function trainWeights(matrix: number[][], labels: number[]) {
  const weights = Array.from({ length: RETURN_RISK_FEATURE_NAMES.length }, () => 0);
  let bias = 0;
  const positiveRows = labels.filter((label) => label === 1).length;
  const negativeRows = labels.length - positiveRows;
  const positiveWeight = positiveRows > 0 ? Math.min(8, negativeRows / positiveRows) : 1;
  const learningRate = 0.04;
  const l2 = 0.001;

  for (let epoch = 0; epoch < 320; epoch += 1) {
    const gradients = Array.from({ length: weights.length }, () => 0);
    let biasGradient = 0;

    for (let rowIndex = 0; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex];
      const label = labels[rowIndex];
      const probability = sigmoid(dot(weights, row) + bias);
      const classWeight = label === 1 ? positiveWeight : 1;
      const error = (probability - label) * classWeight;

      for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
        gradients[featureIndex] += error * row[featureIndex];
      }
      biasGradient += error;
    }

    const normalizer = Math.max(1, matrix.length);
    for (let featureIndex = 0; featureIndex < weights.length; featureIndex += 1) {
      weights[featureIndex] -= learningRate * (gradients[featureIndex] / normalizer + l2 * weights[featureIndex]);
    }
    bias -= learningRate * (biasGradient / normalizer);
  }

  return { weights, bias };
}

export function trainReturnRiskLogisticModel(
  rows: ReturnRiskTrainingRow[],
  modelDate = new Date()
): { artifact: ReturnRiskModelArtifact | null; reason?: string } {
  const trainingRows = rows.length;
  const positiveRows = rows.filter((row) => row.isReturnedOrLost).length;

  if (trainingRows < MIN_TRAINING_ROWS) {
    return { artifact: null, reason: "Model egitimi icin en az 300 gecmis siparis gerekli." };
  }

  if (positiveRows < MIN_POSITIVE_ROWS) {
    return { artifact: null, reason: "Model egitimi icin en az 30 iade/fire ornegi gerekli." };
  }

  const examples = rows.map((row) => buildReturnRiskTrainingExample(row, rows));
  const matrix = examples.map((example) => getReturnRiskFeatureArray(example.vector));
  const labels = examples.map((example) => example.label);
  const { means, scales } = buildScaler(matrix);
  const scaled = matrix.map((row) => scaleRow(row, means, scales));
  const trainMatrix = scaled.filter((_, index) => index % 5 !== 0);
  const trainLabels = labels.filter((_, index) => index % 5 !== 0);
  const testMatrix = scaled.filter((_, index) => index % 5 === 0);
  const testLabels = labels.filter((_, index) => index % 5 === 0);
  const testExamples = examples.filter((_, index) => index % 5 === 0);
  const { weights, bias } = trainWeights(trainMatrix, trainLabels);
  const predictions = testMatrix.map((row, index) => ({
    probability: sigmoid(dot(weights, row) + bias),
    label: testLabels[index],
    expectedCostIfReturned: testExamples[index]?.vector.expectedCostIfReturned,
  }));
  const metrics = evaluateReturnRiskPredictions(predictions);
  const dateToken = modelDate.toISOString().slice(0, 10).replace(/-/g, "");
  const modelVersion = `return-risk-v1-${dateToken}`;
  const stats: ReturnRiskStats = buildReturnRiskStats(rows);

  return {
    artifact: {
      modelVersion,
      modelType: MODEL_TYPE,
      trainedAt: modelDate.toISOString(),
      featureNames: [...RETURN_RISK_FEATURE_NAMES],
      weights: weights.map((value) => Math.round(value * 1000000) / 1000000),
      bias: Math.round(bias * 1000000) / 1000000,
      means,
      scales,
      stats,
      metrics: {
        ...metrics,
        trainingRows,
        positiveRows,
      },
      trainingRows,
      positiveRows,
    },
  };
}

export function predictReturnRiskProbabilityWithModel(
  artifact: ReturnRiskModelArtifact,
  vector: ReturnRiskFeatureVector
) {
  const row = getReturnRiskFeatureArray(vector);
  const scaled = scaleRow(row, artifact.means, artifact.scales);
  return clamp(sigmoid(dot(artifact.weights, scaled) + artifact.bias), 0, 1);
}
