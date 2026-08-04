// lib/features/sentiment/retailLongPercent.js
// FEATURE 1 — Retail Long %
//
// Mathematical definition
//   value = latest MyFXBook longPercentage for the symbol (0-100)
//   normalized_value = linear rescale of value from [0,100] to [-1,+1]
//
// Explanation
//   Raw measure of what fraction of retail traders are currently
//   positioned long on this symbol. This is the base signal every other
//   sentiment feature (delta, velocity, acceleration, persistence) derives
//   from — those describe how this number is *changing*, this feature is
//   the number itself.
//
// Inputs
//   history: array of raw sentiment readings for one symbol, ordered
//     oldest -> newest (see lib/db/sentimentReadings.js), each shaped:
//     { symbol, longPercentage, shortPercentage, fetchedAt, dataDelayMinutes }
//
// Confidence
//   1.0 when the latest reading is fresh (within config.staleness.maxAgeMinutes),
//   decaying toward 0 as the data goes stale (e.g. a missed cron run).

import { buildFeatureResult, normalizeLinear, freshnessConfidence } from "../base";

export const FEATURE_NAME = "retail_long_percent";

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const latest = history[history.length - 1];
  const [rangeMin, rangeMax] = config.range || [0, 100];

  const value = latest.longPercentage;
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
