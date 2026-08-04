// lib/db/sentimentReadings.js
// Read/write helpers for the `sentiment_readings` table (see
// supabase/schema.sql). This is the raw, append-only history of every
// MyFXBook community-outlook poll per symbol — deliberately separate from
// the existing `signals` table (which stores one computed imbalance
// signal), because the Feature Engine (lib/features) needs the full
// underlying time series to compute delta/velocity/acceleration/persistence,
// not just the latest derived score.
//
// This also doubles as this project's historical-replay/backtesting source
// for sentiment features: replaying a symbol's feature history is just
// re-running lib/features/engine.js over successive prefixes of what
// getSentimentHistory() returns.

import { getSupabaseClient } from "./supabase";

const TABLE = "sentiment_readings";

/**
 * Inserts one raw sentiment reading.
 *
 * @param {object} record - { symbol, long_percentage, short_percentage,
 *   long_volume?, short_volume?, avg_long_price?, avg_short_price?,
 *   fetched_at, data_delay_minutes, source }
 * @returns {Promise<object>} the inserted row
 */
export async function insertSentimentReading(record) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from(TABLE).insert(record).select().single();

  if (error) {
    console.error("[sentimentReadings] insertSentimentReading failed:", error.message);
    throw new Error(`insertSentimentReading failed: ${error.message}`);
  }

  return data;
}

/**
 * Returns the last `limit` readings for a symbol, ordered oldest -> newest
 * (the shape every feature module expects), by fetching newest-first and
 * reversing.
 *
 * @param {string} symbol
 * @param {number} [limit=50]
 * @returns {Promise<Array>} normalized readings: { symbol, longPercentage,
 *   shortPercentage, longVolume, shortVolume, fetchedAt, dataDelayMinutes }
 */
export async function getSentimentHistory(symbol, limit = 50) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("symbol", symbol)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[sentimentReadings] getSentimentHistory failed:", error.message);
    return [];
  }

  return (data || [])
    .slice()
    .reverse()
    .map((row) => ({
      symbol: row.symbol,
      longPercentage: row.long_percentage,
      shortPercentage: row.short_percentage,
      longVolume: row.long_volume,
      shortVolume: row.short_volume,
      avgLongPrice: row.avg_long_price,
      avgShortPrice: row.avg_short_price,
      fetchedAt: row.fetched_at,
      dataDelayMinutes: row.data_delay_minutes,
    }));
}
