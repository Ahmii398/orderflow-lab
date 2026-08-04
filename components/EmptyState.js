// components/EmptyState.js
// Shown when a symbol has no signals logged yet — most likely right after
// initial deployment, before the first Cron run has fired.

export default function EmptyState({ symbol }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
      <p className="text-lg font-semibold text-ink">No signals logged yet for {symbol}</p>
      <p className="mt-2 text-sm text-muted">
        The first Cron run will populate this within 15 minutes — check back shortly.
      </p>
    </div>
  );
}
