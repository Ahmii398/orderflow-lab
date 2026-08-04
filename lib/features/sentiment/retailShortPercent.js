// lib/features/sentiment/retailShortPercent.js
// FEATURE 2 — Retail Short %
//
// Same structure as retailLongPercent.js (Feature 1), mirrored for the
// short side. See that file for the full explanation — this one just
// reads shortPercentage instead of longPercentage.

import { buildFeatureResult, normalizeLinear, freshnessConfidence } from "../base";

export const FEATURE_NAME = "retail_short_percent";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const latest = history[history.length - 1];
  const [rangeMin, rangeMax] = config.range || [0, 100];

  const value = latest.shortPercentage;
  const normalizedValue = normalizeLinear(value, rangeMin, rangeMax, -1, 1);
  const confidence = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);

  return buildFeatureResult({
    feature: FEATURE_NAME,
    symbol: latest.symbol,
    value,
    normalizedValue,
    confidence,
    metadata: {
      rawLongPercentage: latest.longPercentage,
      rawShortPercentage: latest.shortPercentage,
      dataDelayMinutes: latest.dataDelayMinutes ?? null,
      sourceReadingTimestamp: latest.fetchedAt,
    },
    timestamp: latest.fetchedAt,
  });
}
