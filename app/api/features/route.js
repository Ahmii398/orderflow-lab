// app/api/features/route.js
// Public read endpoint: latest computed value for every registered feature,
// for one symbol. Read-only — this never hits MyFXBook/Massive itself, it
// just reads whatever the cron job (or POST /api/features/compute) has
// already stored in `feature_values`.
//
// GET /api/features?symbol=EURUSD

import { FEATURE_REGISTRY } from "@/lib/features/registry";
import { getLatestFeatureValues } from "@/lib/db/featureStore";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return Response.json({ error: "Missing required query param: symbol" }, { status: 400 });
  }

  const featureNames = Object.keys(FEATURE_REGISTRY);
  const latest = await getLatestFeatureValues(symbol, featureNames);

  return Response.json({
    symbol,
    features: latest,
    generatedAt: new Date().toISOString(),
  });
}
