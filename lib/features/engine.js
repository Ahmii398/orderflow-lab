// lib/features/engine.js
// The Feature Engine: given a symbol's raw reading history, runs every
// registered feature for a source and returns their results keyed by
// feature name. Storage (lib/db/featureStore.js) and REST exposure
// (app/api/features) are both callers of this, not part of it — this file
// only knows how to compute, never how to persist or serve.

import { FEATURE_REGISTRY, featureNamesForSource } from "./registry";
import { getFeatureConfig } from "./config";

/**
 * Computes every registered "sentiment" feature for one symbol.
 *
 * A single feature throwing (e.g. not enough history yet) does not abort
 * the rest — it's recorded as `null` in the result map with the error
 * logged, so one broken/immature feature never blocks the others.
 *
 * @param {string} symbol
 * @param {Array} sentimentHistory - oldest -> newest raw readings from
 *   lib/db/sentimentReadings.js, all for this one symbol
 * @returns {Object<string, object|null>} feature name -> FeatureResult | null
 */
export function computeSentimentFeatures(symbol, sentimentHistory) {
  const results = {};

  for (const featureName of featureNamesForSource("sentiment")) {
    const { compute } = FEATURE_REGISTRY[featureName];
    const config = getFeatureConfig(featureName);

    try {
      results[featureName] = compute(sentimentHistory, config);
    } catch (err) {
      console.error(`[feature-engine] "${featureName}" failed for ${symbol}:`, err.message || err);
      results[featureName] = null;
    }
  }

  return results;
}
