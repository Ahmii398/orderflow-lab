// lib/analysis/imbalance.js
// Core analysis: order flow imbalance calculation.
//
// Takes one symbol's normalized Myfxbook community-outlook record (see
// lib/sources/myfxbook.js's normalizeOutlook()) and derives a single
// imbalance score + human-readable interpretation from the long/short
// retail-trader skew.
//
// NOTE ON NAMING: the cron route (app/api/cron/fetch-signals/route.js, and
// the older app/api/cron/route.js) imports and calls this as
// `computeImbalance(outlook)`, destructuring `{ imbalanceScore, interpretation }`
// from the result — so that's the exported name used here.
// `calculateImbalance` is exported as an alias of the exact same function,
// in case other code/tests reference it under that name.

/**
 * @typedef {Object} OutlookRecord
 * @property {string} symbol
 * @property {number} longPercentage
 * @property {number} shortPercentage
 * @property {number} longVolume
 * @property {number} shortVolume
 * @property {number} avgLongPrice
 * @property {number} avgShortPrice
 * @property {string} fetchedAt
 * @property {string} source
 * @property {number} dataDelayMinutes
 */

/**
 * Computes an order-flow imbalance score from one symbol's normalized
 * Myfxbook outlook record.
 *
 * imbalanceScore = (longPercentage - shortPercentage) / (longPercentage + shortPercentage)
 * Range: -1 (100% short) to +1 (100% long). If both percentages are 0 (no
 * data / division by zero), returns a neutral 0 score rather than NaN.
 *
 * @param {OutlookRecord} outlookData
 * @returns {{ symbol: string, imbalanceScore: number, interpretation: string, currentPrice: null, calculatedAt: string }}
 */
export function computeImbalance(outlookData) {
  const { symbol, longPercentage, shortPercentage } = outlookData;

  const total = longPercentage + shortPercentage;
  const imbalanceScore = total === 0 ? 0 : (longPercentage - shortPercentage) / total;
  const interpretation = total === 0 ? "neutral" : interpretForScore(imbalanceScore);

  return {
    symbol,
    imbalanceScore,
    interpretation,
    currentPrice: null,
    calculatedAt: new Date().toISOString(),
  };
}

// Alias — same function, exported under the name originally requested.
export const calculateImbalance = computeImbalance;

/** Maps a raw imbalanceScore (-1 to +1) to a human-readable interpretation. */
function interpretForScore(score) {
  if (score >= 0.5) return "strong_bullish_pressure";
  if (score >= 0.15) return "mild_bullish_pressure";
  if (score > -0.15) return "neutral";
  if (score > -0.5) return "mild_bearish_pressure"; // -0.5 < score <= -0.15
  return "strong_bearish_pressure"; // score <= -0.5
}

/**
 * Averages the imbalanceScore of the last `windowSize` entries in `history`,
 * to smooth noise across repeated readings. Uses fewer entries if `history`
 * is shorter than `windowSize`.
 *
 * @param {Array<{ imbalanceScore: number }>} history - ordered oldest -> newest
 * @param {number} [windowSize=20]
 * @returns {number} average imbalanceScore over the window (0 if history is empty)
 */
export function rollingImbalance(history, windowSize = 20) {
  if (!Array.isArray(history) || history.length === 0) return 0;

  const window = history.slice(-windowSize);
  const sum = window.reduce((acc, entry) => acc + (entry?.imbalanceScore ?? 0), 0);

  return sum / window.length;
}
