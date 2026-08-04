// lib/db/featureStore.js
// Read/write helpers for the `feature_values` table (see
// supabase/schema.sql) — the generic, feature-agnostic historical store
// every feature in lib/features writes its output to. One row per
// (feature, symbol, computed_at). Storing every feature in the same table
// with a `feature` discriminator column (rather than one table per feature)
// is what lets app/api/features/route.js expose "every feature for this
// symbol" and historical replay/backtesting work the same way regardless of
// how many features exist.

import { getSupabaseClient } from "./supabase";

const TABLE = "feature_values";

/**
 * Persists a batch of FeatureResults (as produced by lib/features/engine.js)
 * for one symbol. Skips `null` entries (a feature that failed to compute)
 * rather than erroring the whole batch.
 *
 * @param {string} symbol
 * @param {Object<string, object|null>} results - feature name -> FeatureResult | null
 * @returns {Promise<Array>} inserted rows
 */
export async function storeFeatureResults(symbol, results) {
  const rows = Object.values(results)
    .filter(Boolean)
    .map((r) => ({
      feature: r.feature,
      symbol,
      value: r.value,
      normalized_value: r.normalized_value,
      confidence: r.confidence,
      metadata: r.metadata,
      source_timestamp: r.timestamp,
    }));

  if (rows.length === 0) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).insert(rows).select();

  if (error) {
    console.error("[featureStore] storeFeatureResults failed:", error.message);
    throw new Error(`storeFeatureResults failed: ${error.message}`);
  }

  return data;
}

/**
 * Returns the most recent row for every feature name given, for one symbol
 * — used by app/api/features/route.js to answer "what's the current state
 * of every feature for EURUSD".
 *
 * @param {string} symbol
 * @param {Array<string>} featureNames
 * @returns {Promise<Object<string, object|null>>} feature name -> latest row | null
 */
export async function getLatestFeatureValues(symbol, featureNames) {
  const supabase = getSupabaseClient();
  const result = {};

  // One query per feature rather than a single IN(...) query: Postgres
  // doesn't have a clean "latest row per group" without a window function
  // through supabase-js, and this keeps the query trivially indexable via
  // the (feature, symbol, computed_at) index instead of relying on one.
  for (const featureName of featureNames) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("feature", featureName)
      .eq("symbol", symbol)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`[featureStore] getLatestFeatureValues("${featureName}") failed:`, error.message);
      result[featureName] = null;
    } else {
      result[featureName] = data || null;
    }
  }

  return result;
}

/**
 * Returns history for a single feature+symbol, oldest -> newest, for
 * charting/replay/backtesting.
 *
 * @param {string} featureName
 * @param {string} symbol
 * @param {number} [limit=100]
 */
export async function getFeatureHistory(featureName, symbol, limit = 100) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("feature", featureName)
    .eq("symbol", symbol)
    .order("computed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(`[featureStore] getFeatureHistory("${featureName}") failed:`, error.message);
    return [];
  }

  return (data || []).slice().reverse();
}
