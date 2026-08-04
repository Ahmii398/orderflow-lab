// components/DashboardHeader.js
// Top-of-page header: project name plus a plain-language explanation of
// what this dashboard is (and, just as importantly, what it is NOT) so a
// non-technical visitor doesn't mistake this for a live trading feed.

import { WarningIcon } from "./icons";

export default function DashboardHeader() {
  return (
    <header className="bg-white">
      {/* Signature accent: a thin bearish-to-bullish gradient bar. The same
          red -> gray -> green scale reappears in the score gauge and the
          history chart, so it reads as one visual language across the page. */}
      <div
        aria-hidden="true"
        className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg, #D64545 0%, #C7CBD4 50%, #1F9D55 100%)" }}
      />
      <div className="border-b border-line">
        <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-signal-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-signal">
            OrderFlow Lab
          </div>
          <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">
            Positioning Imbalance Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            This dashboard tracks retail trader positioning (long vs. short) to spot
            potential market imbalances.
          </p>
          <p className="mt-3 inline-flex max-w-2xl items-start gap-2 rounded-lg bg-neutral-soft px-3 py-2.5 text-sm text-ink">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <span>
              <strong className="font-semibold">Not live order book data.</strong> This is
              delayed positioning data used as a directional bias indicator, not a
              real-time trading signal.
            </span>
          </p>
        </div>
      </div>
    </header>
  );
}
