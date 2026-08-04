// lib/features/sentiment/velocity.js
// FEATURE 5 — Velocity
//
// Mathematical definition
//   Ordinary-least-squares slope of longPercentage over the last
//   `lookbackReadings` readings (default 5). This is deliberately NOT a
//   naive last-minus-first difference: a straight-line fit over the whole
//   window is far less sensitive to a single noisy reading, and the fit
//   quality (r2) doubles as a confidence signal.
//
// Explanation
//   Distinguishes "60, 61, 62, 63" (low velocity — slope ~1/reading) from
//   "60, 70, 82, 91" (high velocity — slope ~10/reading), i.e. measures the
//   SPEED sentiment is moving, not just whether it moved.
//
// Output
//   value = slope (percentage points per reading)
//   normalized_value = slope rescaled by config.maxExpectedSlopePerReading

import { buildFeatureResult, normalizeLinear, linearRegressionSlope, freshnessConfidence, sampleSizeConfidence } from "../base";

export const FEATURE_NAME = "velocity";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const lookback = config.lookbackReadings ?? 5;
  const window = history.slice(-lookback);
  const latest = history[history.length - 1];

  const { slope, r2 } = linearRegressionSlope(window.map((r) => r.longPercentage));
  const maxSlope = config.maxExpectedSlopePerReading ?? 5;
  const normalizedValue = normalizeLinear(slope, -maxSlope, maxSlope, -1, 1);

  const freshness = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);
  const sampleConfidence = sampleSizeConfidence(window.length, config.minReadingsForFullConfidence ?? lookback);
  // A slope fit to a noisy, non-linear window (low r2) is a less trustworthy
  // number than the same slope fit to a clean linear trend, so fold r2 in too.
  const confidence = freshness * sampleConfidence * (0.5 + 0.5 * r2);

  return buildFeatureResult({
    feature: FEATURE_NAME,
    symbol: latest.symbol,
    value: slope,
    normalizedValue,
    confidence,
    metadata: {
      lookbackReadings: window.length,
      fitQualityR2: r2,
      windowLongPercentages: window.map((r) => r.longPercentage),
    },
    timestamp: latest.fetchedAt,
  });
}
