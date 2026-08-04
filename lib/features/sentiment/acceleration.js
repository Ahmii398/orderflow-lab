// lib/features/sentiment/acceleration.js
// FEATURE 6 — Acceleration
//
// Mathematical definition
//   acceleration = velocity(most recent window) - velocity(prior window)
//   where each "velocity" is the OLS slope (see velocity.js) over
//   `lookbackReadings` non-overlapping readings.
//
// Explanation
//   Measures whether Velocity itself is increasing or decreasing. If
//   buying speed is picking up, acceleration is positive; if buying is
//   slowing down (even if still positive velocity), acceleration is
//   negative. Requires two full lookback windows of history (2x
//   `lookbackReadings`) to compute at all — falls back to 0 with low
//   confidence when there isn't enough history yet.

import { buildFeatureResult, normalizeLinear, linearRegressionSlope, freshnessConfidence, sampleSizeConfidence } from "../base";

export const FEATURE_NAME = "acceleration";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const lookback = config.lookbackReadings ?? 5;
  const latest = history[history.length - 1];
  const maxAccel = config.maxExpectedAccelerationPerReading ?? 3;

  const recentWindow = history.slice(-lookback);
  const priorWindow = history.slice(-lookback * 2, -lookback);

  const recent = linearRegressionSlope(recentWindow.map((r) => r.longPercentage));
  const hasPriorWindow = priorWindow.length >= 2;
  const prior = hasPriorWindow
    ? linearRegressionSlope(priorWindow.map((r) => r.longPercentage))
    : { slope: 0, r2: 0 };

  const accelerationValue = hasPriorWindow ? recent.slope - prior.slope : 0;
  const normalizedValue = normalizeLinear(accelerationValue, -maxAccel, maxAccel, -1, 1);

  const freshness = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);
  const sampleConfidence = sampleSizeConfidence(
    recentWindow.length + priorWindow.length,
    config.minReadingsForFullConfidence ?? lookback * 2
  );
  const fitConfidence = 0.5 + 0.5 * ((recent.r2 + prior.r2) / 2);
  const confidence = freshness * sampleConfidence * fitConfidence;

  return buildFeatureResult({
    feature: FEATURE_NAME,
    symbol: latest.symbol,
    value: accelerationValue,
    normalizedValue,
    confidence,
    metadata: {
      recentVelocity: recent.slope,
      priorVelocity: hasPriorWindow ? prior.slope : null,
      recentWindowSize: recentWindow.length,
      priorWindowSize: priorWindow.length,
      hasPriorWindow,
    },
    timestamp: latest.fetchedAt,
  });
}
