// app/api/debug-myfxbook-login/route.js
//
// TEMPORARY DEBUG ROUTE — remove once the "Invalid session" issue in
// lib/sources/myfxbook.js is diagnosed.
//
// Calls ONLY the Myfxbook login endpoint, directly, with no dependency on
// lib/sources/myfxbook.js at all — so it's completely independent of that
// module's cached-session logic (no cachedSession read/write, no retry-on-
// invalid-session behavior). That isolation is the point: it lets us see
// whether login itself is succeeding and what session token (if any) comes
// back, without the community-outlook call's "Invalid session" error (or
// the session cache) muddying the picture.
//
// Returns Myfxbook's raw JSON response exactly as received — not modified,
// not wrapped in another object. Never logs or returns MYFXBOOK_PASSWORD;
// only Myfxbook's response is exposed.

const LOGIN_URL = "https://www.myfxbook.com/api/login.json";

// Forces this route to always execute fresh — without this, Next.js can
// cache/statically-optimize a GET route with no dynamic input, which would
// return the exact same response (including request_id) on every hit.
export const dynamic = "force-dynamic";

export async function GET() {
  const email = process.env.MYFXBOOK_EMAIL;
  const password = process.env.MYFXBOOK_PASSWORD;

  if (!email || !password) {
    // Not Myfxbook's response — env vars are missing, so there's nothing to
    // call. Distinct from the raw-passthrough case below.
    return Response.json(
      { error: true, message: "Missing MYFXBOOK_EMAIL or MYFXBOOK_PASSWORD environment variables" },
      { status: 500 }
    );
  }

  const url = `${LOGIN_URL}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

  let response;
  try {
    response = await fetch(url, { method: "POST" });
  } catch (err) {
    // A network-level failure before Myfxbook ever responded — still not
    // "Myfxbook's response", so this stays a separate, clearly-labeled shape.
    return Response.json(
      { error: true, message: `Network error calling Myfxbook login: ${err.message || err}` },
      { status: 502 }
    );
  }

  const rawBody = await response.text();

  let data;
  try {
    data = JSON.parse(rawBody);
  } catch (err) {
    // Myfxbook didn't return JSON — pass the raw text straight through
    // rather than guessing at a shape or discarding it.
    return new Response(rawBody, {
      status: response.status,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Myfxbook's raw JSON response, completely unmodified, with its original
  // HTTP status code preserved.
  return Response.json(data, { status: response.status });
}
