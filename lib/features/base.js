// lib/features/base.js
// Shared contract + helpers for the Feature Engineering layer.
//
// Every feature module (lib/features/sentiment/*.js, and future
// price/technical modules) must return its result via buildFeatureResult()
// so that every feature in the system — regardless of what it measures or
// which data source it reads — produces the exact same output shape:
//
//   { feature, symbol, value, normalized_value, confidence, metadata, timestamp }
//
// This is the contract the REST layer (app/api/features), the storage layer
// (lib/db/featureStore.js), and any future dashboard/ML consumer are all
// built against. Nothing downstream should ever need to know the internals
// of an individual feature's calculation.

/**
 * Clamps a number into [min, max].
 */
export function clamp(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Linearly rescales `value` from [inMin, inMax] to [outMin, outMax] and
 * clamps the result, so a feature can never emit a normalized value outside
 * the range downstream consumers are contractually promised.
 */
export function normalizeLinear(value, inMin, inMax, outMin = -1, outMax = 1) {
  if (inMax === inMin) return (outMin + outMax) / 2;
  const t = (value - inMin) / (inMax - inMin);
  const scaled = outMin + t * (outMax - outMin);
  return clamp(scaled, outMin, outMax);
}

/** Division that returns `fallback` instead of NaN/Infinity when `b` is 0. */
export function safeDiv(a, b, fallback = 0) {
  if (!b) return fallback;
  return a / b;
}

/**
 * Ordinary least-squares slope of `values` (indexed 0..n-1 on the x-axis).
 * Used by velocity/acceleration to measure the *rate* of change across a
 * window rather than a naive last-minus-first difference, so a noisy single
 * reading can't dominate the result. Returns { slope, r2 } — r2 (0-1) is how
 * well a straight line fits the window, used as a confidence signal.
 */
export function linearRegressionSlope(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, r2: 0 };

  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    denom += (xs[i] - xMean) ** 2;
  }

  const slope = safeDiv(num, denom, 0);
  const intercept = yMean - slope * xMean;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * xs[i] + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }

  const r2 = ssTot === 0 ? 1 : clamp(1 - ssRes / ssTot, 0, 1);
  return { slope, r2 };
}

/**
 * Confidence penalty for stale data. MyFXBook readings are only produced
 * when the cron job runs, so a gap (missed run, upstream outage) should
 * lower confidence rather than silently serving an old number as if it were
 * fresh. Returns 1 (full confidence) when the latest reading is within
 * `maxAgeMinutes`, decaying linearly to 0 at 2x that age.
 */
export function freshnessConfidence(latestTimestamp, maxAgeMinutes) {
  if (!latestTimestamp || !maxAgeMinutes) return 1;
  const ageMinutes = (Date.now() - new Date(latestTimestamp).getTime()) / 60000;
  if (ageMinutes <= maxAgeMinutes) return 1;
  const overage = ageMinutes - maxAgeMinutes;
  return clamp(1 - overage / maxAgeMinutes, 0, 1);
}

/**
 * Confidence contribution from having "enough" history to trust a windowed
 * calculation (e.g. velocity over 5 readings when only 2 exist yet).
 */
export function sampleSizeConfidence(available, required) {
  if (!required) return 1;
  return clamp(available / required, 0, 1);
}

/**
 * Builds the standardized feature result. Throws early (rather than
 * silently coercing) if a feature module forgets a required field — this is
 * the one place the contract is enforced, so every feature gets the same
 * validation for free.
 */
export function buildFeatureResult({
  feature,
  symbol,
  value,
  normalizedValue,
  confidence,
  metadata = {},
  timestamp,
}) {
  if (!feature) throw new Error("buildFeatureResult: `feature` is required");
  if (!symbol) throw new Error("buildFeatureResult: `symbol` is required");
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`buildFeatureResult: \`value\` must be a number for feature "${feature}"`);
  }
  if (typeof normalizedValue !== "number" || Number.isNaN(normalizedValue)) {
    throw new Error(`buildFeatureResult: \`normalizedValue\` must be a number for feature "${feature}"`);
  }

  return {
    feature,
    symbol,
    value,
    normalized_value: clamp(normalizedValue, -1, 1),
    confidence: clamp(confidence ?? 1, 0, 1),
    metadata,
    timestamp: timestamp || new Date().toISOString(),
  };
}
