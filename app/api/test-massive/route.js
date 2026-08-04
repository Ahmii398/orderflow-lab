// app/api/test-massive/route.js
// Manual verification route for the Massive adapter (lib/sources/massive.js).
//
// Visit this route in the browser (e.g. /api/test-massive) to confirm the
// key-pool rotation + candle fetch is working. Fetches Gold futures ("GC")
// minute candles and also returns the current key pool status so you can
// watch calls rotate across MASSIVE_API_KEY_1..4 as you refresh.
//
// This is a dev/debugging aid, not the public production endpoint.
//
// TEMPORARY DEBUG INSTRUMENTATION: the debugError/httpStatus/rawResponseSnippet/
// requestUrl fields below surface the exact failure from Massive (status code,
// response body, and the exact masked URL called) rather than just an empty
// result, and can be removed once the "empty results" issue is diagnosed.

import { fetchCandles, getKeyPoolStatus, getCurrentFrontMonthTicker } from "@/lib/sources/massive";

// Forces this route to always execute fresh — without this, Next.js can
// cache/statically-optimize a GET route with no dynamic input, which would
// return the exact same response (including request_id) on every hit.
export const dynamic = "force-dynamic";

export async function GET() {
  // Call the resolver directly (not just implicitly through fetchCandles) so
  // its exact return value or thrown error is visible in this debug response
  // no matter what fetchCandles ends up doing with it.
  let resolvedTicker;
  try {
    resolvedTicker = await getCurrentFrontMonthTicker("GC");
  } catch (err) {
    resolvedTicker = `ERROR: ${err.message || err}`;
  }

  const result = await fetchCandles("GC", "1min");

  // fetchCandles() returns a plain array on a genuine success, or
  // { candles: [], debugError, httpStatus, rawResponseSnippet, requestUrl }
  // on failure/empty data — see the TEMPORARY DEBUG SHAPE note in
  // lib/sources/massive.js.
  const isDebugShape = result !== null && typeof result === "object" && !Array.isArray(result);
  const candles = isDebugShape ? result.candles || [] : result || [];
  const debugError = isDebugShape
    ? result.debugError || null
    : result === null
      ? "fetchCandles() returned null (see server logs)"
      : null;
  const httpStatus = isDebugShape ? result.httpStatus ?? null : null;
  const rawResponseSnippet = isDebugShape ? result.rawResponseSnippet ?? null : null;
  const requestUrl = isDebugShape ? result.requestUrl ?? null : null;

  return Response.json({
    ok: !debugError && candles.length > 0,
    count: candles.length,
    candles,
    debugError,
    httpStatus,
    rawResponseSnippet,
    requestUrl,
    resolvedTicker,
    keyPoolStatus: getKeyPoolStatus(),
  });
}
