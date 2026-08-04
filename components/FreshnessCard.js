// components/FreshnessCard.js
// Data freshness card: how long ago the latest signal was logged, plus a
// visible warning when that signal's source data carries a delay (Myfxbook
// free tier can lag live markets by up to 60 minutes).

import { ClockIcon, WarningIcon } from "./icons";

function minutesAgo(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

function formatMinutesAgo(mins) {
  if (mins === 0) return "Just now";
  if (mins === 1) return "1 minute ago";
  return `${mins} minutes ago`;
}

export default function FreshnessCard({ latest }) {
  if (!latest) {
    return (
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <ClockIcon className="h-4 w-4" /> Last updated
        </p>
        <p className="mt-1 text-2xl font-semibold text-ink">No data yet</p>
      </div>
    );
  }

  const mins = minutesAgo(latest.fetched_at);
  const hasDelay = (latest.data_delay_minutes || 0) > 0;

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm font-medium text-muted">
        <ClockIcon className="h-4 w-4" /> Last updated
      </p>
      <p className="mt-1 text-2xl font-semibold text-ink">{formatMinutesAgo(mins)}</p>
      {hasDelay && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-signal-soft px-2.5 py-1.5 text-xs text-ink">
          <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-signal" />
          <span>Note: this data has up to {latest.data_delay_minutes} min delay</span>
        </p>
      )}
    </div>
  );
}
