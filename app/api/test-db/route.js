// app/api/test-db/route.js
// Manual verification route for the Supabase wiring (lib/db/supabase.js,
// lib/db/logger.js). Logs one fake signal for symbol "TEST" and reads it
// back via getRecentSignals to confirm the round trip works end to end.
//
// This is a dev/debugging aid, not the public production endpoint. Re-visiting
// this route repeatedly will insert a new "TEST" row each time — feel free to
// delete rows with symbol = 'TEST' from Supabase afterwards.

import { logSignal, getRecentSignals } from "@/lib/db/logger";

// Forces this route to always execute fresh — without this, Next.js can
// cache/statically-optimize a GET route with no dynamic input, which would
// return the exact same response (including request_id) on every hit.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fakeSignal = {
      symbol: "TEST",
      fetched_at: new Date().toISOString(),
      long_percentage: 62.5,
      short_percentage: 37.5,
      imbalance_score: 0.25,
      interpretation: "bullish",
      current_price: 100.0,
      data_delay_minutes: 60,
      source: "test",
    };

    const inserted = await logSignal(fakeSignal);
    const recent = await getRecentSignals("TEST", 10);

    return Response.json({ ok: true, inserted, recent });
  } catch (err) {
    console.error("[test-db] error:", err.message || err);
    return Response.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}
