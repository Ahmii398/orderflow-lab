// components/ImbalanceGauge.js
// A small horizontal gauge showing where the current imbalance score sits
// on the bearish <-> neutral <-> bullish scale. Scores are assumed to run
// roughly from -1 (fully short-skewed) to +1 (fully long-skewed) and are
// clamped for the purposes of drawing the marker; the exact number is still
// shown as text elsewhere on the card.

const TRACK_X = 4;
const TRACK_WIDTH = 192;

export default function ImbalanceGauge({ score }) {
  const safeScore = typeof score === "number" && !Number.isNaN(score) ? score : 0;
  const clamped = Math.max(-1, Math.min(1, safeScore));
  const t = (clamped + 1) / 2; // 0..1 across the track
  const markerX = TRACK_X + t * TRACK_WIDTH;

  return (
    <div>
      <svg
        viewBox="0 0 200 28"
        className="w-full"
        role="img"
        aria-label={`Imbalance score gauge, currently ${safeScore.toFixed(2)}`}
      >
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D64545" />
            <stop offset="50%" stopColor="#C7CBD4" />
            <stop offset="100%" stopColor="#1F9D55" />
          </linearGradient>
        </defs>
        <rect x={TRACK_X} y="10" width={TRACK_WIDTH} height="6" rx="3" fill="url(#gaugeGradient)" opacity="0.85" />
        <line x1={markerX} y1="2" x2={markerX} y2="24" stroke="#16233D" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between font-figure text-[10px] uppercase tracking-wide text-muted">
        <span>Bearish</span>
        <span>Neutral</span>
        <span>Bullish</span>
      </div>
    </div>
  );
}
