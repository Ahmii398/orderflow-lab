// components/SignalQuality.js
// Signal-quality context for the currently selected symbol. The raw
// imbalance score alone doesn't tell a user how much to trust it given
// Myfxbook's 60-minute data delay — this section adds two at-a-glance
// badges (how strong the current reading is, and how stable the last few
// readings have been) plus a short collapsible explainer for why that
// matters. Pure presentational logic derived from already-fetched
// `signals` (see app/dashboard/page.js) — no new data fetching.

import { ChevronIcon } from "./icons";

const STRENGTH_STRONG_THRESHOLD = 0.5;
const STRENGTH_MODERATE_THRESHOLD = 0.15;

const STABLE_RANGE_MAX = 0.1;
const VOLATILE_RANGE_MIN = 0.3;

const TREND_WINDOW = 4;

const BADGE_TONE_CLASSES = {
  positive: "bg-bullish-soft text-bullish",
  caution: "bg-signal-soft text-signal",
  neutral: "bg-neutral-soft text-neutral",
};

/** Maps |imbalanceScore| to a strength label + badge tone. */
function getSignalStrength(score) {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return { label: "No score yet", tone: "neutral" };
  }

  const abs = Math.abs(score);

  if (abs >= STRENGTH_STRONG_THRESHOLD) {
    return { label: "Strong (more likely to persist despite delay)", tone: "positive" };
  }
  if (abs >= STRENGTH_MODERATE_THRESHOLD) {
    return { label: "Moderate", tone: "neutral" };
  }
  return { label: "Weak (low confidence given data delay)", tone: "caution" };
}

/**
 * Compares the imbalanceScore of the most recent `TREND_WINDOW` readings.
 * Needs a full window of numeric scores to make a call either way; with
 * fewer readings than that (e.g. a symbol just added to tracking) there
 * isn't enough history yet to say anything meaningful.
 */
function getTrendStability(signals) {
  const recentScores = signals
    .slice(0, TREND_WINDOW)
    .map((row) => row.imbalance_score)
    .filter((value) => typeof value === "number" && !Number.isNaN(value));

  if (recentScores.length < TREND_WINDOW) {
    return { label: "Not enough history yet", tone: "neutral" };
  }

  const range = Math.max(...recentScores) - Math.min(...recentScores);

  if (range <= STABLE_RANGE_MAX) {
    return { label: "Stable — consistent positioning", tone: "positive" };
  }
  if (range > VOLATILE_RANGE_MIN) {
    return { label: "Volatile — treat with caution", tone: "caution" };
  }
  return { label: "Mixed — some fluctuation", tone: "neutral" };
}

function QualityBadge({ label, tone }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${BADGE_TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}

export default function SignalQuality({ score, signals }) {
  const strength = getSignalStrength(score);
  const stability = getTrendStability(Array.isArray(signals) ? signals : []);

  return (
    <section
      aria-label="Signal quality"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-lg font-semibold text-ink">Signal quality</h2>
      <p className="mt-1 text-sm text-muted">
        How much weight to give the current reading, given the 60-minute Myfxbook data delay.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl bg-paper p-4">
          <p className="text-sm font-medium text-muted">Signal Strength</p>
          <div className="mt-2">
            <QualityBadge label={strength.label} tone={strength.tone} />
          </div>
        </div>
        <div className="rounded-xl bg-paper p-4">
          <p className="text-sm font-medium text-muted">Trend Stability</p>
          <div className="mt-2">
            <QualityBadge label={stability.label} tone={stability.tone} />
          </div>
        </div>
      </div>

      <details className="group mt-4 rounded-xl bg-paper p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
          Why does the 60-minute delay still matter less for strong signals?
          <ChevronIcon className="h-4 w-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Retail positioning shifts gradually rather than all at once, so a reading that's
          already extreme or has held steady across several readings tends to still be roughly
          accurate an hour later. A mild or fluctuating reading, on the other hand, is much more
          likely to have already flipped by the time you see it — so treat those with more
          caution than the delay alone would suggest.
        </p>
      </details>
    </section>
  );
}
