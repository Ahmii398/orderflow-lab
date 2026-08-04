// lib/db/supabase.js
// Supabase client setup — SERVER-SIDE ONLY.
//
// Uses the service role key (full read/write access, bypasses Row Level
// Security) because this project's Postgres access all happens from
// server-side code: Vercel Cron (app/api/cron), API routes (app/api/signal,
// app/api/test-db), and server components. The service role key must never
// be sent to the browser or referenced from a "use client" component —
// that's why it's read from SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_
// prefix), which Next.js will not inline into client bundles.
//
// Vercel's filesystem is ephemeral, so Supabase/Postgres (via this client)
// is the only place this project persists data.

import { createClient } from "@supabase/supabase-js";

// Module-level cached client, reused across calls within the same
// process/serverless invocation instead of reconnecting every time.
let cachedClient = null;

export function getSupabaseClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      // This client is used server-side with the service role key only —
      // there's no browser session to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}
