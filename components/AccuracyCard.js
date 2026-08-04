// components/AccuracyCard.js
// Accuracy % card with an info icon whose tooltip explains what the metric
// means. Implemented with CSS-only group-hover/group-focus-within so this
// can stay a plain Server Component — no client-side interactivity needed
// for a simple hover/focus tooltip.

import { InfoIcon } from "./icons";

export default function AccuracyCard({ accuracy }) {
  const hasAccuracy = typeof accuracy === "number" && !Number.isNaN(accuracy);
  const display = hasAccuracy ? `${Math.round(accuracy * 100)}%` : "—";

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-medium text-muted">Accuracy</p>
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-describedby="accuracy-tooltip"
            className="flex h-4 w-4 items-center justify-center rounded-full text-muted hover:text-ink focus:outline-none focus:ring-2 focus:ring-signal"
          >
            <InfoIcon className="h-4 w-4" />
            <span className="sr-only">What does accuracy mean?</span>
          </button>
          <span
            id="accuracy-tooltip"
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          >
            Percentage of signals where price moved in the predicted direction within 1
            hour.
          </span>
        </span>
      </div>
      <p className="mt-1 font-figure text-4xl font-semibold text-ink">{display}</p>
      {!hasAccuracy && <p className="mt-2 text-sm text-muted">Not enough evaluated signals yet</p>}
    </div>
  );
}
