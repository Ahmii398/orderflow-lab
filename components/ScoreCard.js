// components/ScoreCard.js
// Summary card: the current imbalance score shown large, with a
// plain-language interpretation underneath in a colored badge (green for
// bullish, red for bearish, gray for neutral), plus a small gauge showing
// where that score sits on the overall scale.

import ImbalanceGauge from "./ImbalanceGauge";
import { getTone, TONE_BADGE_CLASSES } from "./tone";

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

export default function ScoreCard({ score, interpretation }) {
  const tone = getTone(interpretation);

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-muted">Current imbalance score</p>
      <p className="mt-1 font-figure text-4xl font-semibold text-ink">{formatScore(score)}</p>
      <span
        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${TONE_BADGE_CLASSES[tone]}`}
      >
        {interpretation || "No interpretation yet"}
      </span>
      <div className="mt-4">
        <ImbalanceGauge score={score} />
      </div>
    </div>
  );
}
