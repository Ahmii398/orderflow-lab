// components/DataSourceGlossary.js
// Expandable glossary explaining the raw fields behind the dashboard's data
// — separate from ExplainerSection's "what do these numbers mean" framing,
// this is aimed at a new user trying to map a specific field name (as it
// might appear in raw data, exports, or the Myfxbook source) to what it
// actually represents. Same native <details>/<summary> pattern as
// ExplainerSection for consistency and free accessibility.

import { ChevronIcon } from "./icons";

const FIELDS = [
  {
    term: "imbalanceScore",
    body: "(longPercentage − shortPercentage) ÷ (longPercentage + shortPercentage), ranging from −1 (100% of retail traders short) to +1 (100% long). It's the single number the rest of the dashboard is built around.",
  },
  {
    term: "Interpretation labels",
    body: "A category derived from imbalanceScore — e.g. \"strong_bullish_pressure\" or \"mild_bearish_pressure\" when positioning leans one way, or \"neutral\" when it's roughly balanced. These are what get shown as the colored badges throughout the dashboard.",
  },
  {
    term: "avgLongPrice / avgShortPrice",
    body: "The average entry price across all retail traders currently long or short a symbol, per Myfxbook's community outlook. Captured from the same data source as everything else here, though not currently shown as its own column on this dashboard.",
  },
  {
    term: "longVolume / shortVolume",
    body: "The underlying trader counts (or volume) behind longPercentage / shortPercentage — i.e. how many retail positions the percentages are actually calculated from, which is useful context for how much weight to put on a given percentage split.",
  },
  {
    term: "\"1hr outcome: Pending\"",
    body: "Shown in the Recent signals table until a signal is old enough for its 1-hour-later price to have been fetched and compared against the price at signal time. Once that check runs, it updates to \"Correct\" or \"Incorrect\" (or stays blank for neutral calls, which aren't scored either way).",
  },
];

export default function DataSourceGlossary() {
  return (
    <details className="group rounded-2xl border border-line bg-white p-5 shadow-sm open:pb-6">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-ink">
        Data source glossary
        <ChevronIcon className="h-5 w-5 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.term} className="rounded-xl bg-paper p-4">
            <p className="font-figure font-semibold text-ink">{f.term}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
