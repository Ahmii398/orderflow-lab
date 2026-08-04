-- supabase/schema.sql
-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- to create the `signals` table this project reads/writes via
-- lib/db/supabase.js and lib/db/logger.js.

create table signals (
  id bigint generated always as identity primary key,
  symbol text not null,
  fetched_at timestamptz not null default now(),
  long_percentage numeric,
  short_percentage numeric,
  imbalance_score numeric,
  interpretation text,
  current_price numeric,
  data_delay_minutes int default 0,
  price_after_15min numeric,
  price_after_1hr numeric,
  price_after_4hr numeric,
  outcome_evaluated boolean default false,
  source text not null
);

create index on signals (symbol, fetched_at);

-- Optional, but recommended: enable Row Level Security with no policies.
-- This project only ever talks to Supabase using the service role key
-- (server-side, via lib/db/supabase.js), which bypasses RLS entirely, so
-- this has no effect on the app. It just ensures that if the anon/public
-- key is ever used against this table from anywhere else, no rows are
-- readable or writable without an explicit policy.
-- alter table signals enable row level security;

-- ---------------------------------------------------------------------------
-- Feature Engineering layer (lib/features) — added alongside the Feature 1-7
-- (sentiment) rollout. Run this section in addition to the `signals` table
-- above if you already have that one.
-- ---------------------------------------------------------------------------

-- Raw, append-only history of every MyFXBook community-outlook poll per
-- symbol. Distinct from `signals`: this is the full time series the Feature
-- Engine computes delta/velocity/acceleration/persistence from, not a single
-- derived score. Written by app/api/cron/fetch-signals/route.js, read by
-- lib/db/sentimentReadings.js.
create table sentiment_readings (
  id bigint generated always as identity primary key,
  symbol text not null,
  long_percentage numeric,
  short_percentage numeric,
  long_volume numeric,
  short_volume numeric,
  avg_long_price numeric,
  avg_short_price numeric,
  fetched_at timestamptz not null default now(),
  data_delay_minutes int default 0,
  source text not null
);

create index on sentiment_readings (symbol, fetched_at);

-- Generic historical store for every feature's computed output (one row per
-- feature x symbol x computation), regardless of which feature or which
-- upstream data source it reads from. The `feature` column is the
-- discriminator — this is what lets app/api/features/route.js answer "every
-- feature for symbol X" and lets historical replay/backtesting work
-- uniformly as new features (8-19, price/technical) are added.
create table feature_values (
  id bigint generated always as identity primary key,
  feature text not null,
  symbol text not null,
  value numeric,
  normalized_value numeric,
  confidence numeric,
  metadata jsonb,
  source_timestamp timestamptz,
  computed_at timestamptz not null default now()
);

create index on feature_values (feature, symbol, computed_at);

-- alter table sentiment_readings enable row level security;
-- alter table feature_values enable row level security;
