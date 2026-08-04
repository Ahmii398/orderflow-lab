// lib/features/sentiment/longDelta.js
// FEATURE 3 — Long Delta
//
// Mathematical definition
//   delta = currentLongPercentage - previousLongPercentage
//   computed at four horizons: 1 reading back, `shortReadings` back (default
//   5), `mediumReadings` back (default 15), and ~1 hour back by wall clock.
//
// Explanation
//   Measures how aggressively traders are increasing (positive) or
//   decreasing (negative) their long exposure, over several horizons at
//   once so a reader can distinguish a brief blip from a sustained shift.
//
// Output
//   `value`/`normalized_value` are driven by the single-reading delta (the
//   most responsive horizon); the 5/15-reading and 1-hour deltas are always
//   computed and stored in `metadata` per the spec ("store 1 reading, 5
//   readings, 15 readings, 1 hour trend").

import { buildFeatureResult, normalizeLinear, freshnessConfidence, sampleSizeConfidence } from "../base";
import { readingNStepsBack, readingApproxTimeBack, deltaFrom } from "./_deltaHelpers";

export const FEATURE_NAME = "long_delta";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const latest = history[history.length - 1];
  const current = latest.longPercentage;

  const { shortReadings = 5, mediumReadings = 15 } = config.windows || {};
  const hourWindowMs = config.hourWindowMs ?? 3600000;
  const swingPoints = config.normalizationSwingPoints ?? 20;

  const delta1 = deltaFrom(current, readingNStepsBack(history, 1), "longPercentage");
  const delta5 = deltaFrom(current, readingNStepsBack(history, shortReadings), "longPercentage");
  const delta15 = deltaFrom(current, readingNStepsBack(history, mediumReadings), "longPercentage");
  const delta1h = deltaFrom(current, readingApproxTimeBack(history, hourWindowMs), "longPercentage");

  const value = delta1 ?? 0;
  const normalizedValue = normalizeLinear(value, -swingPoints, swingPoints, -1, 1);

  const freshness = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);
  // Delta needs at least 2 readings to mean anything at all — scale
  // confidence down when we don't even have the single-reading comparison.
  const sampleConfidence = sampleSizeConfidence(history.length, 2);
  const confidence = freshness * sampleConfidence;

  return buildFeatureResult({
    feature: FEATURE_NAME,
    symbol: latest.symbol,
    value,
    normalizedValue,
    confidence,
    metadata: {
      delta1Reading: delta1,
      delta5Readings: delta5,
      delta15Readings: delta15,
      delta1Hour: delta1h,
      readingsAvailable: history.length,
      currentLongPercentage: current,
    },
    timestamp: latest.fetchedAt,
  });
}
