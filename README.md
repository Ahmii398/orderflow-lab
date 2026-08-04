# OrderFlow Lab

A Next.js (App Router) dashboard for tracking order flow imbalance signals,
built to deploy on Vercel with Supabase as the database. A Vercel Cron job
periodically pulls data from source adapters (`lib/sources`), computes an
imbalance signal (`lib/analysis`), and stores it in Supabase; the dashboard
and `/api/signal` endpoint read it back out.

This repo currently contains only the project skeleton — no real data
fetching, analysis, or persistence logic is implemented yet.

## Feature Engineering layer (`lib/features`)

The central intelligence layer the platform is built around. Every feature
is a pure, independently testable module that reads raw history and returns
a standardized result:

```js
{ feature, symbol, value, normalized_value, confidence, metadata, timestamp }
```

- `lib/features/base.js` — shared math/contract helpers (normalization,
  linear regression, confidence scoring) every feature builds on.
- `lib/features/config.js` + `config/features.json` — every tunable
  parameter (windows, thresholds, scaling constants) lives in config, never
  hardcoded in feature code.
- `lib/features/registry.js` — where a new feature gets plugged in.
- `lib/features/engine.js` — orchestrates computing every registered
  feature for a symbol from its raw history.
- `lib/features/sentiment/*.js` — **Features 1-7** (Retail Long %, Retail
  Short %, Long Delta, Short Delta, Velocity, Acceleration, Persistence),
  built on MyFXBook community-outlook history. Features 8-19
  (price/technical, correlation, session strength — built on Massive OHLCV)
  are not implemented yet.

Storage: raw MyFXBook polls are appended to `sentiment_readings`; every
feature's computed output is appended to `feature_values` (see
`supabase/schema.sql`) — both are plain historical tables, so replaying or
backtesting a feature is just re-running `lib/features/engine.js` over a
slice of that history.

Endpoints:
- `GET /api/features?symbol=EURUSD` — latest value for every feature
- `GET /api/features/velocity?symbol=EURUSD&limit=100` — one feature's
  latest value + history
- `POST /api/features/compute` (`{ symbol, limit? }`) — recompute + persist
  from already-stored history, no upstream API calls (used by the cron job,
  and reusable for backfill/replay)

Run tests with `npm test` (uses [Vitest](https://vitest.dev/); feature
modules are pure functions, so tests run against synthetic reading
histories with no database or network access needed).
