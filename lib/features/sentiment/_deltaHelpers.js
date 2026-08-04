// lib/features/sentiment/_deltaHelpers.js
// Internal helpers shared by longDelta.js and shortDelta.js. Not a feature
// itself (no FEATURE_NAME export, not in the registry) — just the common
// "how far back was N readings ago / 1 hour ago" logic so the two delta
// features stay in sync instead of drifting apart over time.

/**
 * Returns the reading `stepsBack` entries before the latest one, or null if
 * history isn't long enough yet.
 *
 * @param {Array} history - oldest -> newest
 * @param {number} stepsBack
 */
export function readingNStepsBack(history, stepsBack) {
  const index = history.length - 1 - stepsBack;
  if (index < 0) return null;
  return history[index];
}

/**
 * Finds the reading closest to `windowMs` before the latest reading's
 * timestamp (e.g. ~1 hour ago), searching from the oldest end forward for
 * the first reading old enough, which gives the closest-but-not-newer match.
 * Returns null if no reading is that old yet.
 */
export function readingApproxTimeBack(history, windowMs) {
  if (history.length === 0) return null;
  const latest = history[history.length - 1];
  const targetTime = new Date(latest.fetchedAt).getTime() - windowMs;

  let candidate = null;
  for (const reading of history) {
    const t = new Date(reading.fetchedAt).getTime();
    if (t <= targetTime) {
      candidate = reading; // keep the most recent one that's still <= target
    }
  }
  return candidate;
}

/** Simple delta with a null-safe base — returns null (not 0) when there's nothing to diff against. */
export function deltaFrom(current, previousReading, field) {
  if (!previousReading) return null;
  return current - previousReading[field];
}
