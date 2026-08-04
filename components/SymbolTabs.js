// components/SymbolTabs.js
// Symbol selector, rendered as plain <Link>s to a `?symbol=` query param
// rather than a client-side dropdown. That keeps symbol switching as an
// ordinary navigation (server re-fetch), so the dashboard page can stay a
// Server Component with no client-side data-fetching logic at all.

import Link from "next/link";

// Display label overrides for symbols whose ticker isn't self-explanatory as
// a tab label. Anything not listed here just renders as the raw symbol
// string (e.g. "EURUSD", "XAUUSD", "GBPUSD"), unchanged from before.
const SYMBOL_LABELS = {
  XAGUSD: "Silver",
  USOIL: "Crude Oil",
};

export default function SymbolTabs({ symbols, selected }) {
  return (
    <nav
      className="mx-auto mt-6 flex max-w-6xl flex-wrap gap-2 px-6 sm:px-8"
      aria-label="Select symbol"
    >
      {symbols.map((symbol) => {
        const isActive = symbol === selected;
        return (
          <Link
            key={symbol}
            href={`/dashboard?symbol=${symbol}`}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "rounded-full bg-ink px-4 py-2 font-figure text-sm font-semibold text-white shadow-sm"
                : "rounded-full border border-line bg-white px-4 py-2 font-figure text-sm font-medium text-muted transition-colors hover:border-ink hover:text-ink"
            }
          >
            {SYMBOL_LABELS[symbol] || symbol}
          </Link>
        );
      })}
    </nav>
  );
}
