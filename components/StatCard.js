// components/StatCard.js
// Generic label + big number + optional caption card. Used directly for
// "Total signals logged"; AccuracyCard and FreshnessCard follow the same
// visual shape but need extra content (a tooltip, a warning note), so they
// stay as their own small components rather than over-generalizing this one.

export default function StatCard({ label, value, caption }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-1 font-figure text-4xl font-semibold text-ink">{value}</p>
      {caption && <p className="mt-2 text-sm text-muted">{caption}</p>}
    </div>
  );
}
