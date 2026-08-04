// app/dashboard/page.js
// Main dashboard page — a Server Component that reads directly from
// lib/db/logger.js (no separate API round-trip needed since this renders
// on the server). Symbol selection is a `?symbol=` query param handled via
// plain navigation (see components/SymbolTabs.js), so switching symbols is
// just another server render with fresh data — no client-side data
// fetching required anywhere on this page.

import { getRecentSignals, getStats } from "@/lib/db/logger";
import DashboardHeader from "@/components/DashboardHeader";
import SymbolTabs from "@/components/SymbolTabs";
import ScoreCard from "@/components/ScoreCard";
import StatCard from "@/components/StatCard";
import AccuracyCard from "@/components/AccuracyCard";
import FreshnessCard from "@/components/FreshnessCard";
import ImbalanceChart from "@/components/ImbalanceChart";
import SignalsTable from "@/components/SignalsTable";
import ExplainerSection from "@/components/ExplainerSection";
import SignalQuality from "@/components/SignalQuality";
import DataSourceGlossary from "@/components/DataSourceGlossary";
import EmptyState from "@/components/EmptyState";

// This page's data changes every 15 minutes via Cron and depends on a
// request-time query param — always render fresh rather than letting Next
// cache a static snapshot.
export const dynamic = "force-dynamic";

const SYMBOLS = ["EURUSD", "XAUUSD", "GBPUSD", "XAGUSD", "USOIL"];
const HISTORY_LIMIT = 50;

export default async function DashboardPage({ searchParams }) {
  const params = await searchParams;
  const requested = typeof params?.symbol === "string" ? params.symbol.toUpperCase() : null;
  const selectedSymbol = SYMBOLS.includes(requested) ? requested : SYMBOLS[0];

  const [signals, stats] = await Promise.all([
    getRecentSignals(selectedSymbol, HISTORY_LIMIT),
    getStats(selectedSymbol),
  ]);

  const latest = signals[0] ?? null;
  // getRecentSignals() returns newest-first (for the table); the chart
  // reads left-to-right as a timeline, so reverse it to oldest-first.
  const chartHistory = [...signals].reverse();

  return (
    <main className="min-h-screen bg-paper pb-16">
      <DashboardHeader />
      <SymbolTabs symbols={SYMBOLS} selected={selectedSymbol} />

      <div className="mx-auto mt-6 flex max-w-6xl flex-col gap-8 px-6 sm:px-8">
        {signals.length === 0 ? (
          <EmptyState symbol={selectedSymbol} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
              <ScoreCard score={latest?.imbalance_score} interpretation={latest?.interpretation} />
              <StatCard
                label="Total signals logged"
                value={stats.totalSignals.toLocaleString()}
                caption={`All-time, ${selectedSymbol}`}
              />
              <AccuracyCard accuracy={stats.accuracy} />
              <FreshnessCard latest={latest} />
            </section>

            <SignalQuality score={latest?.imbalance_score} signals={signals} />

            <section
              aria-label="Imbalance score history"
              className="rounded-2xl border border-line bg-white p-5 shadow-sm"
            >
              <h2 className="font-display text-lg font-semibold text-ink">
                Imbalance score history — last {chartHistory.length} readings
              </h2>
              <p className="mt-1 text-sm text-muted">
                Green bars mean positioning leaned bullish at that moment, red means
                bearish, gray means roughly neutral.
              </p>
              <div className="mt-4">
                <ImbalanceChart data={chartHistory} />
              </div>
            </section>

            <section aria-label="Recent signals">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent signals</h2>
              <SignalsTable signals={signals} />
            </section>
          </>
        )}

        <ExplainerSection />
        <DataSourceGlossary />
      </div>
    </main>
  );
}
