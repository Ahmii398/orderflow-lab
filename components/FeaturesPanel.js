// components/FeaturesPanel.js
// Displays the output of the Feature Engine (lib/features) — Features 1-7,
// read from `feature_values` via lib/db/featureStore.getLatestFeatureValues.
// Each feature is rendered as a small card: its current value, a
// -1..+1 normalized bar, and a confidence percentage. A feature that hasn't
// computed yet (not enough history, or a compute error) shows a clear
// "not enough data yet" state instead of a blank/zero value, so it's never
// confused with an actual reading of 0.

const FEATURE_LABELS = {
  retail_long_percent: "Retail long %",
  retail_short_percent: "Retail short %",
  long_delta: "Long delta (1 reading)",
  short_delta: "Short delta (1 reading)",
  velocity: "Velocity",
  acceleration: "Acceleration",
  persistence: "Persistence",
};

function formatValue(featureName, row) {
  if (!row) return null;
  const v = row.value;
  if (typeof v !== "number" || Number.isNaN(v)) return null;

  switch (featureName) {
    case "retail_long_percent":
    case "retail_short_percent":
      return `${v.toFixed(1)}%`;
    case "persistence": {
      const streak = Math.abs(v);
      const direction = row.metadata?.direction ?? (v > 0 ? "bullish" : v < 0 ? "bearish" : "neutral");
      return `${streak} reading${streak === 1 ? "" : "s"} (${direction})`;
    }
    default:
      return v > 0 ? `+${v.toFixed(3)}` : v.toFixed(3);
  }
}

function NormalizedBar({ normalizedValue }) {
  const clamped = Math.min(1, Math.max(-1, normalizedValue ?? 0));
  // 0 -> 50%, -1 -> 0%, +1 -> 100%
  const positionPercent = ((clamped + 1) / 2) * 100;

  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-line">
      <div
        className="h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-ink"
        style={{ marginLeft: `${positionPercent}%` }}
      />
    </div>
  );
}

function FeatureTile({ featureName, row }) {
  const label = FEATURE_LABELS[featureName] ?? featureName;
  const displayValue = formatValue(featureName, row);
  const confidencePercent = row ? Math.round((row.confidence ?? 0) * 100) : null;

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>

      {displayValue !== null ? (
        <>
          <p className="mt-1 font-figure text-xl font-semibold text-ink">{displayValue}</p>
          <NormalizedBar normalizedValue={row.normalized_value} />
          <p className="mt-2 text-xs text-muted">Confidence: {confidencePercent}%</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">Not enough data yet</p>
      )}
    </div>
  );
}

export default function FeaturesPanel({ features }) {
  const featureNames = Object.keys(FEATURE_LABELS);
  const hasAnyData = featureNames.some((name) => features?.[name]);

  return (
    <section
      aria-label="Sentiment features"
      className="rounded-2xl border border-line bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-lg font-semibold text-ink">Sentiment features</h2>
      <p className="mt-1 text-sm text-muted">
        Derived signals computed from the same Myfxbook positioning history — how fast
        sentiment is moving (velocity), whether that move is speeding up or slowing down
        (acceleration), and how long it has held one direction (persistence).
      </p>

      {!hasAnyData && (
        <p className="mt-3 rounded-lg bg-neutral-soft px-3 py-2 text-sm text-muted">
          No feature values stored yet for this symbol. These fill in automatically as the
          cron job collects more readings over time (some, like acceleration, need at least
          10 readings of history before they compute).
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {featureNames.map((name) => (
          <FeatureTile key={name} featureName={name} row={features?.[name] ?? null} />
        ))}
      </div>
    </section>
  );
}
