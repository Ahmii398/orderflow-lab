// app/api/features/compute/route.js
// Recomputes and persists every sentiment feature for a symbol from
// whatever `sentiment_readings` history already exists in the DB — no
// MyFXBook/Massive calls happen here. This is what the cron job calls right
// after storing a new raw reading, and it's also the historical-replay /
// backtesting hook: re-run this over successive points in time (bounded via
// `limit`) to reconstruct what every feature would have read at any past
// moment, without re-fetching anything from upstream.
//
// POST /api/features/compute
// body: { symbol: "EURUSD", limit?: 50 }

import { getSentimentHistory } from "@/lib/db/sentimentReadings";
import { computeSentimentFeatures } from "@/lib/features/engine";
import { storeFeatureResults } from "@/lib/db/featureStore";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { symbol, limit = 50 } = body;

  if (!symbol) {
    return Response.json({ error: "Missing required field: symbol" }, { status: 400 });
  }

  const history = await getSentimentHistory(symbol, limit);

  if (history.length === 0) {
    return Response.json(
      { error: `No sentiment_readings history found for "${symbol}" — nothing to compute from` },
      { status: 404 }
    );
  }

  const results = computeSentimentFeatures(symbol, history);
  const stored = await storeFeatureResults(symbol, results);

  return Response.json({
    symbol,
    readingsUsed: history.length,
    computed: results,
    storedCount: stored.length,
  });
}
