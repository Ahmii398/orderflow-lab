// components/ExplainerSection.js
// Expandable "What do these numbers mean?" glossary. Uses the native
// <details>/<summary> elements rather than client-side state — it's
// keyboard- and screen-reader-accessible for free and keeps this a plain
// Server Component.

import { ChevronIcon } from "./icons";

const DEFINITIONS = [
  {
    term: "Imbalance score",
    body: "A single number summarizing how lopsided trader positioning is for a symbol — strongly negative means heavily short, strongly positive means heavily long. Values near zero mean positioning is roughly balanced.",
  },
  {
    term: "Long / short percentage",
    body: "The share of retail traders currently holding a long (betting the price rises) versus short (betting the price falls) position on this symbol, based on Myfxbook's community outlook data.",
  },
  {
    term: "Interpretation categories",
    body: "A plain-language label derived from the imbalance score — for example a \"Bullish\" or \"Bearish\" label when positioning leans strongly one way, or \"Neutral\" when it's roughly balanced.",
  },
  {
    term: "Why is there a data delay?",
    body: "Positioning data comes from Myfxbook's free community outlook API, which can lag live markets by up to 60 minutes. That makes it useful as a directional bias indicator, but not a substitute for a live order book or real-time price feed.",
  },
];

export default function ExplainerSection() {
  return (
    <details className="group rounded-2xl border border-line bg-white p-5 shadow-sm open:pb-6">
      <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-semibold text-ink">
        What do these numbers mean?
        <ChevronIcon className="h-5 w-5 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {DEFINITIONS.map((d) => (
          <div key={d.term} className="rounded-xl bg-paper p-4">
            <p className="font-semibold text-ink">{d.term}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{d.body}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
