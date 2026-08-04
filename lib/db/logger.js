// lib/db/logger.js
// Read/write helpers for the `signals` table (see the SQL migration this
// module was built against, provided alongside this file / in the project
// docs). All persistence for this project lives in Supabase — Vercel's
// filesystem is ephemeral, so nothing here is ever written to disk.

import { getSupabaseClient } from "./supabase";

const TABLE = "signals";

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const FOUR_HOUR_MS = 4 * 60 * 60 * 1000;

/**
 * Inserts one row into `signals`.
 *
 * @param {object} record - column values for the new row, e.g.
 *   { symbol, long_percentage, short_percentage, imbalance_score,
 *     interpretation, current_price, data_delay_minutes, source,
 *     fetched_at? } — fetched_at defaults to now() in Postgres if omitted.
 * @returns {Promise<object>} the inserted row (including generated id)
 */
export async function logSignal(record) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from(TABLE).insert(record).select().single();

  if (error) {
    console.error("[logger] logSignal failed:", error.message);
    throw new Error(`logSignal failed: ${error.message}`);
  }

  return data;
}

function isBullish(row) {
  return typeof row.interpretation === "string" && row.interpretation.toLowerCase().includes("bull");
}

function isBearish(row) {
  return typeof row.interpretation === "string" && row.interpretation.toLowerCase().includes("bear");
}

/**
 * Whether a signal's predicted direction matches what actually happened by
 * the 1hr mark. Returns null (not counted as right or wrong) for rows whose
 * `interpretation` isn't clearly bullish or bearish (e.g. "neutral").
 */
function isCorrect(row) {
  if (row.price_after_1hr === null || row.price_after_1hr === undefined) return null;
  if (row.current_price === null || row.current_price === undefined) return null;

  if (isBullish(row)) return row.price_after_1hr > row.current_price;
  if (isBearish(row)) return row.price_after_1hr < row.current_price;
  return null;
}

function accuracyOf(rows) {
  if (rows.length === 0) return null;
  const correctCount = rows.filter((row) => isCorrect(row) === true).length;
  return correctCount / rows.length;
}

/**
 * Finds signals whose 15min/1hr/4hr outcome checkpoints have arrived but
 * haven't been filled in yet, fetches a current price for each affected
 * symbol via the caller-supplied `getCurrentPrice(symbol)`, and fills in the
 * corresponding price_after_X column(s). Marks a row `outcome_evaluated =
 * true` once all three checkpoints are filled.
 *
 * `getCurrentPrice` is passed in (rather than imported from a specific
 * source adapter) so this module stays decoupled from any one data source —
 * the caller decides whether that means Massive, Myfxbook, or something else.
 *
 * Note: since this only runs periodically (e.g. on a cron schedule), the
 * price recorded for each checkpoint is "whatever the current price is the
 * first time this function runs after that checkpoint has passed" — a
 * reasonable approximation given there's no dedicated historical price feed
 * wired up here, but not perfectly exact to the checkpoint minute.
 *
 * @param {(symbol: string) => Promise<number|null>} getCurrentPrice
 * @returns {Promise<{ updated: number, evaluated: number }>}
 */
export async function updateOutcomes(getCurrentPrice) {
  const supabase = getSupabaseClient();
  const now = Date.now();

  // Only rows old enough for at least the earliest (15min) checkpoint to
  // possibly apply, and not already fully evaluated.
  const cutoff15 = new Date(now - FIFTEEN_MIN_MS).toISOString();

  const { data: candidateRows, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("outcome_evaluated", false)
    .lte("fetched_at", cutoff15);

  if (error) {
    console.error("[logger] updateOutcomes: failed to query candidate rows:", error.message);
    return { updated: 0, evaluated: 0 };
  }

  const rowsNeedingWork = (candidateRows || [])
    .map((row) => {
      const elapsed = now - new Date(row.fetched_at).getTime();
      return {
        row,
        needs15: row.price_after_15min === null && elapsed >= FIFTEEN_MIN_MS,
        needs1hr: row.price_after_1hr === null && elapsed >= ONE_HOUR_MS,
        needs4hr: row.price_after_4hr === null && elapsed >= FOUR_HOUR_MS,
      };
    })
    .filter(({ needs15, needs1hr, needs4hr }) => needs15 || needs1hr || needs4hr);

  if (rowsNeedingWork.length === 0) {
    return { updated: 0, evaluated: 0 };
  }

  // Fetch a current price once per distinct symbol rather than once per
  // row, to minimize calls into the caller-supplied getCurrentPrice.
  const symbols = [...new Set(rowsNeedingWork.map(({ row }) => row.symbol))];
  const priceBySymbol = {};

  for (const symbol of symbols) {
    try {
      priceBySymbol[symbol] = await getCurrentPrice(symbol);
    } catch (err) {
      console.error(`[logger] updateOutcomes: getCurrentPrice("${symbol}") failed:`, err.message || err);
      priceBySymbol[symbol] = null;
    }
  }

  let updatedCount = 0;
  let evaluatedCount = 0;

  for (const { row, needs15, needs1hr, needs4hr } of rowsNeedingWork) {
    const currentPrice = priceBySymbol[row.symbol];

    if (currentPrice === null || currentPrice === undefined) {
      // Couldn't get a price for this symbol this round — leave the row as
      //-is and let the next scheduled run try again.
      continue;
    }

    const update = {};
    if (needs15) update.price_after_15min = currentPrice;
    if (needs1hr) update.price_after_1hr = currentPrice;
    if (needs4hr) update.price_after_4hr = currentPrice;

    const finalPrice15 = needs15 ? currentPrice : row.price_after_15min;
    const finalPrice1hr = needs1hr ? currentPrice : row.price_after_1hr;
    const finalPrice4hr = needs4hr ? currentPrice : row.price_after_4hr;
    const allFilled = finalPrice15 !== null && finalPrice1hr !== null && finalPrice4hr !== null;

    if (allFilled) {
      update.outcome_evaluated = true;
    }

    const { error: updateError } = await supabase.from(TABLE).update(update).eq("id", row.id);

    if (updateError) {
      console.error(`[logger] updateOutcomes: failed to update row ${row.id}:`, updateError.message);
      continue;
    }

    updatedCount += 1;
    if (update.outcome_evaluated) evaluatedCount += 1;
  }

  return { updated: updatedCount, evaluated: evaluatedCount };
}

/**
 * Computes accuracy stats for a symbol from evaluated signals.
 * "Correct" means price moved in the predicted direction (per
 * `interpretation`) by the 1hr mark. Rows whose interpretation isn't
 * clearly bullish/bearish are excluded from the direction-based accuracy
 * figures but still counted in totalSignals.
 *
 * @param {string} symbol
 * @param {Date|string} [sinceDate] - only include signals fetched on/after this date
 * @returns {Promise<{ totalSignals: number, accuracy: number|null,
 *   bullishAccuracy: number|null, bearishAccuracy: number|null }>}
 *   accuracy fields are null (not 0) when there's no data to compute them from.
 */
export async function getStats(symbol, sinceDate) {
  const supabase = getSupabaseClient();

  let query = supabase
    .from(TABLE)
    .select("*")
    .eq("symbol", symbol)
    .eq("outcome_evaluated", true)
    .not("price_after_1hr", "is", null)
    .not("current_price", "is", null);

  if (sinceDate) {
    const sinceIso = sinceDate instanceof Date ? sinceDate.toISOString() : sinceDate;
    query = query.gte("fetched_at", sinceIso);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error("[logger] getStats query failed:", error.message);
    return { totalSignals: 0, accuracy: null, bullishAccuracy: null, bearishAccuracy: null };
  }

  const safeRows = rows || [];
  const bullishRows = safeRows.filter(isBullish);
  const bearishRows = safeRows.filter(isBearish);
  const directionalRows = safeRows.filter((row) => isBullish(row) || isBearish(row));

  return {
    totalSignals: safeRows.length,
    accuracy: accuracyOf(directionalRows),
    bullishAccuracy: accuracyOf(bullishRows),
    bearishAccuracy: accuracyOf(bearishRows),
  };
}

/**
 * Returns the most recent signals for a symbol, newest first — for display
 * on the dashboard.
 *
 * @param {string} symbol
 * @param {number} [limit=50]
 * @returns {Promise<Array>} rows, or [] on error
 */
export async function getRecentSignals(symbol, limit = 50) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("symbol", symbol)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[logger] getRecentSignals failed:", error.message);
    return [];
  }

  return data || [];
}
