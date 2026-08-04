// app/api/cron/fetch-signals/route.js
//
// Vercel Cron endpoint: pulls Myfxbook community outlook + Massive prices for
// a configured list of symbols, computes an imbalance signal for each, logs
// it, and backfills any older signals that are now due for outcome
// evaluation.
//
// ---------------------------------------------------------------------------
// Setting CRON_SECRET (Vercel Cron authentication)
// ---------------------------------------------------------------------------
// 1. In the Vercel dashboard: Project -> Settings -> Environment Variables,
//    add CRON_SECRET with a long random value (e.g. `openssl rand -hex 32`).
//    Add it for the Production environment at minimum (Preview too if you
//    want to test cron-protected routes on preview deployments).
// 2. Also add it to .env.local for local testing (see .env.example).
// 3. How verification works: once CRON_SECRET is set on the project, Vercel
//    automatically attaches it to every request it sends to any route
//    referenced in vercel.json's `crons` array, as a standard bearer header:
//      Authorization: Bearer <CRON_SECRET>
//    Vercel does this itself — you don't configure the header anywhere,
//    you only set the env var. This route just needs to check the incoming
//    Authorization header against process.env.CRON_SECRET and reject
//    anything that doesn't match, which stops anyone who finds this URL from
//    triggering paid API calls / DB writes on demand.
// 4. Note this only authenticates requests coming from *Vercel's own* cron
//    dispatcher. It does not add general-purpose auth — don't reuse this
//    route for anything meant to be called by other clients.
// ---------------------------------------------------------------------------

import { fetchCommunityOutlook, normalizeOutlook } from "@/lib/sources/myfxbook";
import { fetchCandles } from "@/lib/sources/massive";
import { computeImbalance } from "@/lib/analysis/imbalance";
import { logSignal, updateOutcomes } from "@/lib/db/logger";
import { insertSentimentReading, getSentimentHistory } from "@/lib/db/sentimentReadings";
import { computeSentimentFeatures } from "@/lib/features/engine";
import { storeFeatureResults } from "@/lib/db/featureStore";

// Forces this route to always execute fresh — it hits live upstream APIs and
// writes to the DB on every call, so a cached/stale response would be wrong.
export const dynamic = "force-dynamic";

// Symbols this cron job processes each run. Add to this list as new
// instruments are supported — no other code needs to change as long as the
// symbol exists in both Myfxbook's outlook data and (via the mapping below,
// if needed) Massive.
const SYMBOLS = ["EURUSD", "XAUUSD", "GBPUSD", "XAGUSD", "USOIL"];

// Myfxbook symbol -> Massive futures ticker. Only needed where the names
// differ; anything absent from this map is passed through to Massive as-is
// (e.g. spot-style forex tickers, if/when Massive supports them directly).
// Note: Massive's free-tier futures endpoint generally wants a specific
// contract + expiration code (e.g. "GCJ5"), not just the root ("GC") — the
// root is used here as a reasonable placeholder and should be swapped for a
// front-month contract resolver once that logic exists.
const MASSIVE_SYMBOL_MAP = {
  XAUUSD: "GC", // Gold futures
  EURUSD: "6E", // Euro FX futures
  GBPUSD: "6B", // British Pound futures
  XAGUSD: "SI", // Silver futures
  USOIL: "CL", // Crude Oil (WTI) futures
};

function toMassiveSymbol(symbol) {
  return MASSIVE_SYMBOL_MAP[symbol] || symbol;
}

/**
 * Fetches the latest close price for a symbol via Massive. Returns null if
 * no candles could be retrieved (rate-limited, bad ticker, network error,
 * etc.) rather than throwing, so callers can decide how to handle a miss.
 */
async function getCurrentPrice(symbol) {
  const massiveSymbol = toMassiveSymbol(symbol);
  const candles = await fetchCandles(massiveSymbol);

  if (!candles || candles.length === 0) {
    return null;
  }

  return candles[candles.length - 1].close;
}

export async function GET(request) {
  // 1. Verify the request actually came from Vercel Cron.
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const processedSymbols = [];
  const errors = [];

  // 2. Fetch Myfxbook community outlook once — it covers every symbol in a
  // single call, so this must not be called per-symbol inside the loop
  // below (that would burn through the 100 requests/day free-tier cap fast).
  const outlookRecords = normalizeOutlook(await fetchCommunityOutlook());

  // 3. Process each configured symbol independently.
  for (const symbol of SYMBOLS) {
    try {
      const outlook = outlookRecords.find((record) => record.symbol === symbol);

      if (!outlook) {
        throw new Error(`No Myfxbook outlook data found for symbol "${symbol}"`);
      }

      const currentPrice = await getCurrentPrice(symbol);

      if (currentPrice === null) {
        throw new Error(`Could not retrieve a current price for "${symbol}" via Massive`);
      }

      const { imbalanceScore, interpretation } = computeImbalance(outlook);

      await logSignal({
        symbol,
        long_percentage: outlook.longPercentage,
        short_percentage: outlook.shortPercentage,
        imbalance_score: imbalanceScore,
        interpretation,
        current_price: currentPrice,
        data_delay_minutes: outlook.dataDelayMinutes,
        source: outlook.source,
        fetched_at: outlook.fetchedAt,
      });

      // Feed the Feature Engine (lib/features): store this raw reading in
      // the append-only sentiment_readings history, then recompute every
      // registered sentiment feature (1-7) from that updated history and
      // persist their outputs to feature_values. A failure here is logged
      // but never blocks signal logging above or the next symbol — the
      // Feature Engine is additive, not a dependency of the existing signal
      // pipeline.
      try {
        await insertSentimentReading({
          symbol,
          long_percentage: outlook.longPercentage,
          short_percentage: outlook.shortPercentage,
          long_volume: outlook.longVolume,
          short_volume: outlook.shortVolume,
          avg_long_price: outlook.avgLongPrice,
          avg_short_price: outlook.avgShortPrice,
          fetched_at: outlook.fetchedAt,
          data_delay_minutes: outlook.dataDelayMinutes,
          source: outlook.source,
        });

        const history = await getSentimentHistory(symbol, 50);
        const featureResults = computeSentimentFeatures(symbol, history);
        await storeFeatureResults(symbol, featureResults);
      } catch (featureErr) {
        console.error(
          `[cron/fetch-signals] Feature Engine step failed for "${symbol}":`,
          featureErr.message || featureErr
        );
        errors.push({ symbol, error: `feature-engine: ${featureErr.message || featureErr}` });
      }

      processedSymbols.push(symbol);
    } catch (err) {
      console.error(`[cron/fetch-signals] Failed processing "${symbol}":`, err.message || err);
      errors.push({ symbol, error: err.message || String(err) });
    }
  }

  // 4. Backfill outcomes for older signals now due for evaluation. This is
  // independent of this run's symbol processing above, so a failure here
  // shouldn't be conflated with a specific symbol's error.
  try {
    await updateOutcomes(getCurrentPrice);
  } catch (err) {
    console.error("[cron/fetch-signals] updateOutcomes failed:", err.message || err);
    errors.push({ symbol: null, error: `updateOutcomes: ${err.message || err}` });
  }

  // 5. Summary response.
  return Response.json({
    processedSymbols,
    errors,
    timestamp: new Date().toISOString(),
  });
}
