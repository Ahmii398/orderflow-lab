// app/api/test-myfxbook/route.js
// Manual verification route for the Myfxbook adapter (lib/sources/myfxbook.js).
//
// Visit this route in the browser (e.g. /api/test-myfxbook) to confirm the
// login + community-outlook fetch + normalization pipeline is working end to
// end. This is a dev/debugging aid, not the public production endpoint —
// app/api/signal will be the real public-facing route later.
//
// Remember: this data is delayed up to 60 minutes on the free tier (see
// dataDelayMinutes on each returned record) and free-tier calls are capped
// at 100/24h, so avoid hammering this route in a refresh loop.
//
// TEMPORARY DEBUG INSTRUMENTATION: the debugError/httpStatus/rawResponseSnippet
// fields below surface the exact failure from Myfxbook (rather than just an
// empty result) and can be removed once the underlying issue is diagnosed.

import { fetchCommunityOutlook, normalizeOutlook } from "@/lib/sources/myfxbook";

// Forces this route to always execute fresh — without this, Next.js can
// cache/statically-optimize a GET route with no dynamic input, which would
// return the exact same response (including request_id) on every hit.
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await fetchCommunityOutlook();

  // fetchCommunityOutlook() returns a plain array on success, or
  // { data: [], error, httpStatus, rawResponseSnippet } on failure — see the
  // TEMPORARY DEBUG SHAPE note in lib/sources/myfxbook.js.
  const isDebugShape = !Array.isArray(result);
  const rawSymbols = isDebugShape ? result.data || [] : result;
  const debugError = isDebugShape ? result.error || null : null;
  const httpStatus = isDebugShape ? result.httpStatus ?? null : null;
  const rawResponseSnippet = isDebugShape ? result.rawResponseSnippet ?? null : null;

  const normalized = normalizeOutlook(rawSymbols);

  return Response.json({
    ok: !debugError,
    count: normalized.length,
    data: normalized,
    debugError,
    httpStatus,
    rawResponseSnippet,
  });
}
