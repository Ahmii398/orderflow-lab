// app/api/signal/route.js
// Public read endpoint for external consumption.
//
// Intended to eventually expose the latest computed order flow imbalance
// signal (and perhaps recent history) as JSON, read from Supabase via
// lib/db/supabase.js. This is meant to be consumed by things outside this
// project (other apps, scripts, bots, etc.), so treat its response shape as
// a public contract once implemented.
//
// No real logic yet — just the route skeleton.

export async function GET(request) {
  // TODO: read latest signal(s) from Supabase via lib/db/supabase.js
  // TODO: shape the response as a stable public JSON contract
  // TODO: consider caching / revalidation strategy for external consumers

  return Response.json({ ok: true, message: "signal placeholder — no logic implemented yet" });
}
