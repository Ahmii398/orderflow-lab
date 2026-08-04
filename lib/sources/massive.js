// lib/sources/massive.js
// Data source adapter: Massive.com futures/commodities REST API.
//
// Key facts about this API (do not deviate from these elsewhere in the app):
//   - Aggregate bars endpoint: GET
//     https://api.massive.com/futures/v1/aggs/{ticker}?resolution=<size>&apiKey=<key>
//     e.g. https://api.massive.com/futures/v1/aggs/GCJ5?resolution=1min&limit=50
//     (`ticker` is the specific futures contract, e.g. "GCJ5" for April 2025
//     gold — Massive requires the contract + expiration code on most plans;
//     whatever string is passed in as `symbol` here is sent through as-is).
//   - `resolution` is a number + unit (`sec`, `min`, `hour`, `session`, `week`,
//     `month`, `quarter`, `year`) — minute bars go up to `59min`.
//   - Response: { results: [{ open, high, low, close, volume, window_start
//     (nanosecond Unix timestamp), ticker, session_end_date, ... }], status }
//   - Free tier ("Futures Basic") is limited to 5 API calls / minute per key.
//
// This module pools up to 4 keys (MASSIVE_API_KEY_1..4) and rotates between
// them to work around that per-key limit.

const KEY_ENV_NAMES = [
  "MASSIVE_API_KEY_1",
  "MASSIVE_API_KEY_2",
  "MASSIVE_API_KEY_3",
  "MASSIVE_API_KEY_4",
];

const AGGS_BASE_URL = "https://api.massive.com/futures/v1/aggs";
const CONTRACTS_BASE_URL = "https://api.massive.com/futures/v1/contracts";
const RATE_LIMIT_PER_MINUTE = 5;
const WINDOW_MS = 60 * 1000;
const MAX_WAIT_MS = 30 * 1000;
const SNIPPET_LENGTH = 500;
const FRONT_MONTH_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — front month doesn't change intraday

// Module-level in-memory cache: root symbol (e.g. "GC") -> { ticker, expiresAt }.
// Resets on process/serverless-function restart, same as callTimestamps below.
const frontMonthCache = {};

// Module-level in-memory rate tracker: label (env var name) -> array of call
// timestamps (ms) that fall within the current rolling 60s window. Resets on
// process/serverless-function restart, which is fine — the pool just starts
// fresh with all keys available.
const callTimestamps = {};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads MASSIVE_API_KEY_1 through MASSIVE_API_KEY_4 from the environment,
 * skipping any that are undefined/empty. Works fine with only 1-3 keys
 * configured. Read fresh each call so it stays cheap and picks up env
 * changes in dev without a restart.
 */
function loadKeyPool() {
  return KEY_ENV_NAMES.map((envName) => ({ label: envName, key: process.env[envName] })).filter(
    (entry) => typeof entry.key === "string" && entry.key.trim().length > 0
  );
}

/** Drops timestamps older than the current 60s window and returns what's left. */
function pruneOld(label, now) {
  const fresh = (callTimestamps[label] || []).filter((ts) => now - ts < WINDOW_MS);
  callTimestamps[label] = fresh;
  return fresh;
}

function getUsage(label, now) {
  return pruneOld(label, now).length;
}

function recordCall(label, now) {
  if (!callTimestamps[label]) callTimestamps[label] = [];
  callTimestamps[label].push(now);
}

/**
 * Forces a key to read as "at its limit" for the rest of the current window.
 * Used when Massive returns a 429 despite our local tracker thinking the key
 * still had room (e.g. clock drift, or calls made outside this process).
 */
function markKeyExhausted(label, now) {
  callTimestamps[label] = new Array(RATE_LIMIT_PER_MINUTE).fill(now);
}

function findAvailableKey(pool, now, excludeLabels) {
  for (const entry of pool) {
    if (excludeLabels.has(entry.label)) continue;
    if (getUsage(entry.label, now) < RATE_LIMIT_PER_MINUTE) {
      return entry;
    }
  }
  return null;
}

/** Earliest timestamp (ms) at which any non-excluded key will free up a slot. */
function earliestFreeAt(pool, now, excludeLabels) {
  let earliest = Infinity;
  for (const entry of pool) {
    if (excludeLabels.has(entry.label)) continue;
    const arr = pruneOld(entry.label, now);
    if (arr.length === 0) continue; // shouldn't happen if findAvailableKey already failed
    const freeAt = arr[0] + WINDOW_MS;
    if (freeAt < earliest) earliest = freeAt;
  }
  return earliest;
}

/**
 * Picks the first key with room in the current 60s window. If every
 * (non-excluded) key is currently at its limit, waits for the exact amount
 * of time until the earliest one frees up — capped at MAX_WAIT_MS total.
 * Returns null (with a clear warning logged) if that cap would be exceeded,
 * or if there are no keys left to try at all.
 */
async function getAvailableKey(pool, excludeLabels) {
  const callStart = Date.now();

  while (true) {
    const now = Date.now();
    const activePool = pool.filter((entry) => !excludeLabels.has(entry.label));
    if (activePool.length === 0) {
      return null;
    }

    const key = findAvailableKey(pool, now, excludeLabels);
    if (key) return key;

    const freeAt = earliestFreeAt(pool, now, excludeLabels);
    if (!isFinite(freeAt)) return null; // safety net, shouldn't normally happen

    const waitMs = Math.max(freeAt - now, 0);
    const elapsedSoFar = now - callStart;

    if (elapsedSoFar + waitMs > MAX_WAIT_MS) {
      console.warn(
        `[massive] All ${activePool.length} available key(s) are rate-limited (5/min). ` +
          `Earliest key frees up in ~${Math.ceil(waitMs / 1000)}s, which exceeds the ` +
          `${MAX_WAIT_MS / 1000}s max wait. Giving up on this request.`
      );
      return null;
    }

    console.warn(
      `[massive] All available key(s) are at the 5 calls/60s limit. Waiting ` +
        `~${Math.ceil(waitMs / 1000)}s for a key to free up...`
    );
    await sleep(waitMs);
    // loop again — the freed-up key will be picked up by findAvailableKey
  }
}

/** Converts Massive's nanosecond Unix `window_start` into an ISO timestamp string. */
function nsToIso(windowStartNs) {
  if (typeof windowStartNs !== "number") return null;
  return new Date(windowStartNs / 1e6).toISOString();
}

/** Maps raw Massive aggregate bars into this project's normalized candle shape. */
function normalizeCandles(symbol, results) {
  if (!Array.isArray(results)) return [];
  return results.map((bar) => ({
    symbol,
    timestamp: nsToIso(bar.window_start),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    source: "massive",
  }));
}

/**
 * Masks an API key for safe logging/returning: keeps a few characters on
 * each end so you can still tell keys apart, without exposing the full
 * secret. e.g. "sk_live_abcd1234efgh" -> "sk_l...efgh".
 * TEMPORARY DEBUG HELPER — only used by the debug instrumentation below.
 */
function maskApiKey(key) {
  if (!key) return "MISSING_KEY";
  if (key.length <= 8) return "*".repeat(key.length);
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/** Builds the aggregates request URL for a given symbol/interval/apiKey. */
function buildAggsUrl(symbol, interval, apiKey) {
  return (
    `${AGGS_BASE_URL}/${encodeURIComponent(symbol)}` +
    `?resolution=${encodeURIComponent(interval)}&limit=50&apiKey=${encodeURIComponent(apiKey)}`
  );
}

/** Returns today's date as YYYY-MM-DD (UTC), the format Massive's contracts endpoint expects. */
function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/** Builds the contracts lookup request URL for a given root symbol/date/apiKey. */
function buildContractsUrl(rootSymbol, dateStr, apiKey) {
  return (
    `${CONTRACTS_BASE_URL}?product_code=${encodeURIComponent(rootSymbol)}` +
    `&date=${encodeURIComponent(dateStr)}&active=true&type=single` +
    `&apiKey=${encodeURIComponent(apiKey)}`
  );
}

/**
 * Resolves a futures root symbol (e.g. "GC", "SI", "CL") to the specific
 * front-month contract ticker Massive's aggregates endpoint requires (e.g.
 * "GCF7"). Massive's `/contracts` endpoint returns all matching contracts
 * for a product code on a given date, including combo spreads (`type` other
 * than `"single"`) — those are filtered out, and the remaining single
 * contract with the earliest `last_trade_date` is the front month.
 *
 * Results are cached per root symbol for 6 hours, since the front month
 * doesn't change intraday, to avoid burning API calls on every candle fetch.
 *
 * @param {string} rootSymbol - futures root symbol, e.g. "GC"
 * @returns {Promise<string>} the resolved contract ticker, e.g. "GCF7"
 * @throws if no keys are configured, the request fails, or no matching
 *   single contract is found
 */
export async function getCurrentFrontMonthTicker(rootSymbol) {
  const now = Date.now();
  const cached = frontMonthCache[rootSymbol];
  if (cached && cached.expiresAt > now) {
    return cached.ticker;
  }

  const pool = loadKeyPool();
  if (pool.length === 0) {
    throw new Error("No API keys configured — set at least one of MASSIVE_API_KEY_1..4");
  }

  const excluded = new Set();
  const dateStr = todayDateString();

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const entry = await getAvailableKey(pool, excluded);
    if (!entry) {
      throw new Error(
        `No API key became available to resolve front-month contract for "${rootSymbol}" ` +
          `(rate-limited, or all keys excluded after 429s).`
      );
    }

    recordCall(entry.label, Date.now());

    const requestUrl = buildContractsUrl(rootSymbol, dateStr, entry.key);
    const maskedUrl = buildContractsUrl(rootSymbol, dateStr, maskApiKey(entry.key));
    console.log(`[massive] Resolving front-month contract for "${rootSymbol}" (${entry.label}): ${maskedUrl}`);

    let response;
    try {
      response = await fetch(requestUrl, { method: "GET" });
    } catch (err) {
      throw new Error(
        `Network error resolving front-month contract for "${rootSymbol}" using ${entry.label}: ${err.message || err}`
      );
    }

    if (response.status === 429) {
      console.warn(
        `[massive] ${entry.label} returned 429 while resolving "${rootSymbol}" — ` +
          `marking it exhausted and rotating to the next key.`
      );
      markKeyExhausted(entry.label, Date.now());
      excluded.add(entry.label);
      continue; // try again with a different key
    }

    const rawBody = await response.text();

    if (!response.ok) {
      throw new Error(
        `Massive contracts request failed (${response.status} ${response.statusText}) ` +
          `resolving "${rootSymbol}" using ${entry.label} | Response snippet: ` +
          `${rawBody.slice(0, SNIPPET_LENGTH)}`
      );
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      throw new Error(`Failed to parse Massive contracts response as JSON for "${rootSymbol}": ${err.message}`);
    }

    const contracts = Array.isArray(data.results) ? data.results : [];
    const singleContracts = contracts.filter((contract) => contract.type === "single");

    if (singleContracts.length === 0) {
      throw new Error(`No active single-type contracts returned by Massive for root symbol "${rootSymbol}"`);
    }

    const frontMonth = singleContracts.reduce((earliest, contract) => {
      if (!earliest) return contract;
      return new Date(contract.last_trade_date) < new Date(earliest.last_trade_date) ? contract : earliest;
    }, null);

    if (!frontMonth || !frontMonth.ticker) {
      throw new Error(`Could not determine a front-month ticker for root symbol "${rootSymbol}" from Massive's response`);
    }

    frontMonthCache[rootSymbol] = {
      ticker: frontMonth.ticker,
      expiresAt: Date.now() + FRONT_MONTH_CACHE_TTL_MS,
    };

    return frontMonth.ticker;
  }

  throw new Error(
    `All ${pool.length} configured key(s) were rejected with 429 while resolving front-month contract for "${rootSymbol}".`
  );
}

/**
 * Fetches minute (or other resolution) aggregate candles for a futures
 * symbol from Massive, automatically rotating across the configured key
 * pool to work around the 5 calls/minute/key free-tier limit.
 *
 * - Picks the first key under its local rate limit.
 * - If all keys are at their limit, waits for the exact time until the
 *   earliest one frees up (capped at 30s total; returns a debug result past
 *   that).
 * - If Massive still returns 429 for a key we thought had room, marks that
 *   key exhausted immediately and rotates to the next available key rather
 *   than failing the whole request.
 *
 * TEMPORARY DEBUG SHAPE: on a genuine success (candles actually came back)
 * this still resolves to a plain array, unchanged, so existing callers (e.g.
 * the cron route) keep working un-modified. On any failure — no keys
 * configured, network error, non-2xx response, unparseable body, or a 200 OK
 * with no candle data — this now resolves to:
 *   { candles: [], debugError, httpStatus, rawResponseSnippet, requestUrl }
 * `httpStatus`/`rawResponseSnippet` are Massive's actual response for the
 * call that failed. `requestUrl` is the exact endpoint + query string that
 * was called, with the API key masked, so the path/params can be verified
 * without exposing the secret. Once the "empty results" issue is diagnosed,
 * this can revert to always returning a plain array (or null).
 *
 * @param {string} symbol - futures root symbol, e.g. "GC", "SI", "CL" — this
 *   is resolved to the current front-month contract ticker (e.g. "GCF7")
 *   via getCurrentFrontMonthTicker() before the aggregates request is made
 * @param {string} interval - Massive `resolution` value, default "1min"
 * @returns {Promise<Array|{candles: Array, debugError: string, httpStatus: number|null, rawResponseSnippet: string|null, requestUrl: string|null}>}
 */
export async function fetchCandles(symbol, interval = "1min") {
  const pool = loadKeyPool();

  if (pool.length === 0) {
    const debugError = "No API keys configured — set at least one of MASSIVE_API_KEY_1..4";
    console.error(`[massive] ${debugError}`);
    return { candles: [], debugError, httpStatus: null, rawResponseSnippet: null, requestUrl: null };
  }

  // `symbol` is a futures root (e.g. "GC") — Massive's aggregates endpoint
  // needs the actual current front-month contract ticker (e.g. "GCF7"), not
  // the root, so resolve it first (cached for 6h per root symbol).
  let resolvedTicker;
  try {
    resolvedTicker = await getCurrentFrontMonthTicker(symbol);
  } catch (err) {
    const debugError = `Failed to resolve front-month contract for root symbol "${symbol}": ${err.message || err}`;
    console.error(`[massive] ${debugError}`);
    return { candles: [], debugError, httpStatus: null, rawResponseSnippet: null, requestUrl: null };
  }

  const excluded = new Set();
  let lastMaskedUrl = null;

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const entry = await getAvailableKey(pool, excluded);
    if (!entry) {
      // Either the 30s wait cap was exceeded, or every key has now been
      // excluded after a 429 — nothing left to try for this request.
      const debugError =
        "No API key became available within the wait cap (rate-limited, or all keys excluded after 429s).";
      console.error(`[massive] ${debugError}`);
      return { candles: [], debugError, httpStatus: null, rawResponseSnippet: null, requestUrl: lastMaskedUrl };
    }

    recordCall(entry.label, Date.now());

    const requestUrl = buildAggsUrl(resolvedTicker, interval, entry.key);
    const maskedUrl = buildAggsUrl(resolvedTicker, interval, maskApiKey(entry.key));
    lastMaskedUrl = maskedUrl;

    // TEMPORARY DEBUG LOGGING — remove once the "empty results" issue is
    // diagnosed. Confirms the exact endpoint path + query params being hit,
    // with the API key masked.
    console.log(`[massive] Requesting (${entry.label}): ${maskedUrl}`);

    let response;
    try {
      response = await fetch(requestUrl, { method: "GET" });
    } catch (err) {
      const debugError = `Network error calling Massive using ${entry.label}: ${err.message || err}`;
      console.error(`[massive] ${debugError}`);
      return { candles: [], debugError, httpStatus: null, rawResponseSnippet: null, requestUrl: maskedUrl };
    }

    if (response.status === 429) {
      console.warn(
        `[massive] ${entry.label} returned 429 despite local tracking showing room — ` +
          `marking it exhausted and rotating to the next key.`
      );
      markKeyExhausted(entry.label, Date.now());
      excluded.add(entry.label);
      continue; // try again with a different key
    }

    const rawBody = await response.text();
    const rawResponseSnippet = rawBody.slice(0, SNIPPET_LENGTH);

    if (!response.ok) {
      const debugError = `Massive request failed (${response.status} ${response.statusText}) using ${entry.label}`;
      console.error(`[massive] ${debugError} | Response snippet: ${rawResponseSnippet}`);
      return { candles: [], debugError, httpStatus: response.status, rawResponseSnippet, requestUrl: maskedUrl };
    }

    let data;
    try {
      data = JSON.parse(rawBody);
    } catch (err) {
      const debugError = `Failed to parse Massive response as JSON: ${err.message}`;
      console.error(`[massive] ${debugError} | Response snippet: ${rawResponseSnippet}`);
      return { candles: [], debugError, httpStatus: response.status, rawResponseSnippet, requestUrl: maskedUrl };
    }

    const candles = normalizeCandles(symbol, data.results || []);

    if (candles.length === 0) {
      const debugError = "Massive returned 200 OK but no candle data (empty/missing `results`).";
      console.warn(`[massive] ${debugError} | Response snippet: ${rawResponseSnippet}`);
      return { candles: [], debugError, httpStatus: response.status, rawResponseSnippet, requestUrl: maskedUrl };
    }

    return candles; // genuine success — plain array, unchanged shape for existing callers
  }

  const debugError = `All ${pool.length} configured key(s) were rejected with 429 for this request.`;
  console.warn(`[massive] ${debugError}`);
  return { candles: [], debugError, httpStatus: 429, rawResponseSnippet: null, requestUrl: lastMaskedUrl };
}

/**
 * Debug helper: returns how many calls each configured key has used in the
 * current rolling 60s window, e.g. for showing rotation on the dashboard.
 * Uses the env var name as the key identifier — never exposes the raw key.
 */
export function getKeyPoolStatus() {
  const pool = loadKeyPool();
  const now = Date.now();
  return pool.map((entry) => ({
    key: entry.label,
    callsUsedInWindow: getUsage(entry.label, now),
    limit: RATE_LIMIT_PER_MINUTE,
  }));
}
