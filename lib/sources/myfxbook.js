// lib/sources/myfxbook.js
// Data source adapter: Myfxbook Community Outlook (free tier).
//
// Key facts about this API (do not deviate from these elsewhere in the app):
//   - Login: POST https://www.myfxbook.com/api/login.json with email/password,
//     returns a session token.
//   - Community outlook: GET
//     https://www.myfxbook.com/api/get-community-outlook.json?session=<token>
//     returns ALL symbols in a single call (there is no per-symbol endpoint).
//   - Free tier is capped at 100 requests / 24h — the session is cached in
//     memory here specifically to avoid burning requests on repeated logins.
//   - Data is delayed by up to 60 minutes for free accounts. This is a
//     positioning/context signal, NOT a live trading trigger. Every
//     normalized record carries `dataDelayMinutes: 60` so downstream
//     consumers can't mistake it for real-time data.

const LOGIN_URL = "https://www.myfxbook.com/api/login.json";
const COMMUNITY_OUTLOOK_URL = "https://www.myfxbook.com/api/get-community-outlook.json";
const DATA_DELAY_MINUTES = 60;
const SNIPPET_LENGTH = 500;

// Module-level in-memory session cache. This resets whenever the serverless
// function/process restarts, which is expected and fine — getMyfxbookSession()
// will just log in again on the next call.
let cachedSession = null;

/**
 * Logs in to Myfxbook using MYFXBOOK_EMAIL / MYFXBOOK_PASSWORD env vars and
 * returns a session token. Reuses the cached session if one is already
 * present in memory; only hits the login endpoint when there is no cached
 * session (e.g. on cold start, or after fetchCommunityOutlook() clears the
 * cache in response to an invalid-session error).
 *
 * TEMPORARY DEBUG INSTRUMENTATION: on failure, the thrown Error carries
 * `httpStatus` and `rawResponseSnippet` properties (in addition to the usual
 * `message`) so fetchCommunityOutlook()'s catch block can surface Myfxbook's
 * actual HTTP status + response body, not just a generic message. Remove
 * once the login issue is diagnosed.
 */
export async function getMyfxbookSession() {
  if (cachedSession) {
    return cachedSession;
  }

  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing MYFXBOOK_EMAIL or MYFXBOOK_PASSWORD environment variables"
    );
  }

  const url = `${LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const response = await fetch(url, { method: "POST" });

  // TEMPORARY DEBUG LOGGING — remove once the login flow is confirmed
  // working. Logs the raw response before any error handling touches it, so
  // we can see exactly what Myfxbook sent back (status + body) even in cases
  // that don't cleanly match the error branches below. Read as text once and
  // reuse it (rather than also calling response.json()) so the body stream
  // is only consumed a single time.
  const rawLoginBody = await response.text();
  console.log("[myfxbook] Raw login response:", response.status, rawLoginBody);

  const snippet = rawLoginBody.slice(0, SNIPPET_LENGTH);

  if (!response.ok) {
    const err = new Error(`Myfxbook login HTTP error: ${response.status} ${response.statusText}`);
    err.httpStatus = response.status;
    err.rawResponseSnippet = snippet;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(rawLoginBody);
  } catch (parseErr) {
    const err = new Error(`Myfxbook login response was not valid JSON: ${parseErr.message}`);
    err.httpStatus = response.status;
    err.rawResponseSnippet = snippet;
    throw err;
  }

  if (data.error) {
    const err = new Error(`Myfxbook login failed: ${data.message || "unknown error"}`);
    err.httpStatus = response.status;
    err.rawResponseSnippet = snippet;
    throw err;
  }

  if (!data.session) {
    const err = new Error("Myfxbook login response did not include a session token");
    err.httpStatus = response.status;
    err.rawResponseSnippet = snippet;
    throw err;
  }

  // Myfxbook's login response sometimes returns the session token already
  // URL-encoded (literal %2F, %3D, etc. in the JSON value). Decode it here,
  // once, so what we cache — and later encode into request URLs — is always
  // the raw token. Without this, requestCommunityOutlook()'s
  // encodeURIComponent(session) call would be encoding an already-encoded
  // string, corrupting it (e.g. "%2F" becoming "%252F") and causing Myfxbook
  // to reject it as an invalid session.
  let decodedSession;
  try {
    decodedSession = decodeURIComponent(data.session);
  } catch (decodeErr) {
    const err = new Error(`Myfxbook session token could not be decoded: ${decodeErr.message}`);
    err.httpStatus = response.status;
    err.rawResponseSnippet = snippet;
    throw err;
  }

  cachedSession = decodedSession;
  return cachedSession;
}

/**
 * Fetches the community outlook for ALL symbols in a single call, using a
 * cached session where possible. If Myfxbook reports the session is
 * invalid/expired, clears the cache and logs in exactly once more before
 * giving up.
 *
 * Never throws — on any failure this logs clearly AND returns the error
 * details alongside the (empty) data, so callers can surface them instead of
 * failing silently.
 *
 * TEMPORARY DEBUG SHAPE: on success this still resolves to a plain array
 * (unchanged, so existing callers like the cron route keep working
 * un-modified). On failure it now resolves to
 * { data: [], error, httpStatus, rawResponseSnippet } instead of just [].
 * `httpStatus` and `rawResponseSnippet` capture Myfxbook's actual HTTP status
 * code and response body for the call that failed, so the real cause is
 * visible without digging through server logs. Once the underlying issue is
 * diagnosed, this can revert to always returning a plain array.
 *
 * @returns {Promise<Array|{data: Array, error: string, httpStatus: number|null, rawResponseSnippet: string|null}>}
 */
export async function fetchCommunityOutlook() {
  try {
    let session = await getMyfxbookSession();
    let result = await requestCommunityOutlook(session);

    if (result.invalidSession) {
      // Cached session was stale/expired — clear it and log in fresh, once.
      cachedSession = null;
      session = await getMyfxbookSession();
      result = await requestCommunityOutlook(session);
    }

    if (result.invalidSession || result.error) {
      const message = result.message || "unknown error";
      console.error(
        "[myfxbook] fetchCommunityOutlook failed after retry:",
        message,
        "| httpStatus:",
        result.httpStatus,
        "| snippet:",
        result.rawResponseSnippet
      );
      return {
        data: [],
        error: message,
        httpStatus: result.httpStatus ?? null,
        rawResponseSnippet: result.rawResponseSnippet ?? null,
      };
    }

    return result.symbols || [];
  } catch (err) {
    const message = err.message || String(err);
    console.error(
      "[myfxbook] fetchCommunityOutlook error:",
      message,
      "| httpStatus:",
      err.httpStatus,
      "| snippet:",
      err.rawResponseSnippet
    );
    return {
      data: [],
      error: message,
      httpStatus: err.httpStatus ?? null,
      rawResponseSnippet: err.rawResponseSnippet ?? null,
    };
  }
}

/**
 * Internal helper: performs the actual get-community-outlook.json request
 * for a given session and interprets the response, distinguishing an
 * "invalid session" error from other errors so the caller can decide whether
 * to retry with a fresh login.
 *
 * TEMPORARY DEBUG INSTRUMENTATION: error results now also carry `httpStatus`
 * and `rawResponseSnippet` so the real HTTP status/body reach
 * fetchCommunityOutlook()'s return value, not just a message string.
 */
async function requestCommunityOutlook(session) {
  // `session` is the raw, decoded token cached by getMyfxbookSession() (see
  // the decodeURIComponent() call there) — encode it into the query string
  // exactly once, here, and nowhere else.
  const url = `${COMMUNITY_OUTLOOK_URL}?session=${encodeURIComponent(session)}`;
  const response = await fetch(url, { method: "GET" });
  const rawBody = await response.text();
  const rawResponseSnippet = rawBody.slice(0, SNIPPET_LENGTH);

  if (!response.ok) {
    return {
      error: true,
      message: `Myfxbook community-outlook HTTP error: ${response.status} ${response.statusText}`,
      httpStatus: response.status,
      rawResponseSnippet,
    };
  }

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (parseErr) {
    return {
      error: true,
      message: `Myfxbook community-outlook response was not valid JSON: ${parseErr.message}`,
      httpStatus: response.status,
      rawResponseSnippet,
    };
  }

  if (data.error) {
    const message = (data.message || "").toLowerCase();
    const invalidSession =
      message.includes("session") &&
      (message.includes("invalid") || message.includes("expired"));

    return {
      error: true,
      invalidSession,
      message: data.message,
      httpStatus: response.status,
      rawResponseSnippet,
    };
  }

  return { symbols: data.symbols || [] };
}

/**
 * Maps raw Myfxbook symbol entries into this project's normalized shape.
 * Pure function, no network calls — safe to unit test directly.
 *
 * @param {Array} rawSymbols - the raw `symbols` array from Myfxbook
 * @returns {Array} normalized records
 */
export function normalizeOutlook(rawSymbols) {
  if (!Array.isArray(rawSymbols)) {
    return [];
  }

  const fetchedAt = new Date().toISOString();

  return rawSymbols.map((raw) => ({
    symbol: raw.name,
    longPercentage: raw.longPercentage,
    shortPercentage: raw.shortPercentage,
    longVolume: raw.longVolume,
    shortVolume: raw.shortVolume,
    avgLongPrice: raw.avgLongPrice,
    avgShortPrice: raw.avgShortPrice,
    fetchedAt,
    source: "myfxbook",
    dataDelayMinutes: DATA_DELAY_MINUTES,
  }));
}
