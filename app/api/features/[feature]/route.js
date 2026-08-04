// app/api/features/[feature]/route.js
// Public read endpoint: one feature's latest value plus history, for one
// symbol — the shape a dashboard chart or ML training job would want.
//
// GET /api/features/velocity?symbol=EURUSD&limit=100

import { isRegisteredFeature } from "@/lib/features/registry";
import { getFeatureHistory } from "@/lib/db/featureStore";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { feature } = await params;
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const limit = Number(searchParams.get("limit")) || 100;

  if (!isRegisteredFeature(feature)) {
    return Response.json({ error: `Unknown feature: "${feature}"` }, { status: 404 });
  }

  if (!symbol) {
    return Response.json({ error: "Missing required query param: symbol" }, { status: 400 });
  }

  const history = await getFeatureHistory(feature, symbol, limit);
  const latest = history.length > 0 ? history[history.length - 1] : null;

  return Response.json({
    feature,
    symbol,
    latest,
    history,
  });
}
