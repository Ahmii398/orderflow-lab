// lib/features/sentiment/shortDelta.js
// FEATURE 4 — Short Delta
//
// Same structure as longDelta.js (Feature 3), mirrored for the short side.
// See that file for the full explanation.

import { buildFeatureResult, normalizeLinear, freshnessConfidence, sampleSizeConfidence } from "../base";
import { readingNStepsBack, readingApproxTimeBack, deltaFrom } from "./_deltaHelpers";

export const FEATURE_NAME = "short_delta";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const latest = history[history.length - 1];
  const current = latest.shortPercentage;

  const { shortReadings = 5, mediumReadings = 15 } = config.windows || {};
  const hourWindowMs = config.hourWindowMs ?? 3600000;
  const swingPoints = config.normalizationSwingPoints ?? 20;

  const delta1 = deltaFrom(current, readingNStepsBack(history, 1), "shortPercentage");
  const delta5 = deltaFrom(current, readingNStepsBack(history, shortReadings), "shortPercentage");
  const delta15 = deltaFrom(current, readingNStepsBack(history, mediumReadings), "shortPercentage");
  const delta1h = deltaFrom(current, readingApproxTimeBack(history, hourWindowMs), "shortPercentage");

  const value = delta1 ?? 0;
  const normalizedValue = normalizeLinear(value, -swingPoints, swingPoints, -1, 1);

  const freshness = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);
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
      currentShortPercentage: current,
    },
    timestamp: latest.fetchedAt,
  });
}
