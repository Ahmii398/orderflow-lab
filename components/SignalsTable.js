// components/SignalsTable.js
// Table of recent signals for the selected symbol: time, score,
// interpretation, price at signal, and whether the 1hr-later price
// confirmed the predicted direction.

import { getTone } from "./tone";
import { CheckIcon, CrossIcon } from "./icons";

function formatTime(iso) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScore(score) {
  if (typeof score !== "number" || Number.isNaN(score)) return "—";
  return score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2);
}

function formatPrice(price) {
  if (typeof price !== "number" || Number.isNaN(price)) return "—";
  return price.toLocaleString(undefined, { maximumFractionDigits: 5 });
}

// Mirrors the isCorrect() logic in lib/db/logger.js for display purposes:
// a bullish call is "correct" if price rose by the 1hr mark, a bearish call
// is "correct" if price fell. Neutral calls aren't scored either way.
function outcomeFor(row) {
  if (row.price_after_1hr == null || row.current_price == null) {
    return <span className="text-xs font-medium text-muted">Pending</span>;
  }

  const tone = getTone(row.interpretation);
  if (tone === "neutral") {
    return <span className="text-xs text-muted">—</span>;
  }

  const correct =
    tone === "bullish" ? row.price_after_1hr > row.current_price : row.price_after_1hr < row.current_price;

  return correct ? (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-bullish">
      <CheckIcon className="h-4 w-4" /> Correct
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-bearish">
      <CrossIcon className="h-4 w-4" /> Incorrect
    </span>
  );
}

export default function SignalsTable({ signals }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line bg-neutral-soft/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Time</th>
              <th className="px-4 py-3 font-semibold">Imbalance score</th>
              <th className="px-4 py-3 font-semibold">Interpretation</th>
              <th className="px-4 py-3 font-semibold">Price at signal</th>
              <th className="px-4 py-3 font-semibold">1hr outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {signals.map((row) => {
              const tone = getTone(row.interpretation);
              return (
                <tr key={row.id} className="hover:bg-paper/60">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{formatTime(row.fetched_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-figure font-semibold text-ink">
                    {formatScore(row.imbalance_score)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        tone === "bullish"
                          ? "bg-bullish-soft text-bullish"
                          : tone === "bearish"
                            ? "bg-bearish-soft text-bearish"
                            : "bg-neutral-soft text-neutral"
                      }`}
                    >
                      {row.interpretation || "Unknown"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-figure text-ink">
                    {formatPrice(row.current_price)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{outcomeFor(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
