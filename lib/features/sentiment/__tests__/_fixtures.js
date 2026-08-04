// Test-only helper: builds a synthetic sentiment reading the same shape
// lib/db/sentimentReadings.js#getSentimentHistory returns, so feature tests
// never need a real database.
export function reading(symbol, longPercentage, minutesAgo = 0) {
  return {
    symbol,
    longPercentage,
    shortPercentage: 100 - longPercentage,
    longVolume: null,
    shortVolume: null,
    fetchedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    dataDelayMinutes: 60,
  };
}

/** Builds a history array from a plain list of longPercentage values, spaced `stepMinutes` apart, oldest -> newest. */
export function historyFrom(symbol, longPercentages, stepMinutes = 15) {
  const n = longPercentages.length;
  return longPercentages.map((v, i) => reading(symbol, v, (n - 1 - i) * stepMinutes));
}
