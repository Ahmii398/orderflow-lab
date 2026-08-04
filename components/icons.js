// components/icons.js
// Small inline SVG icon set used across the dashboard. Kept dependency-free
// (no icon library in package.json) since these are the only handful of
// icons the dashboard needs.

export function InfoIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 10-1.5 0 .75.75 0 001.5 0zM9 9a.75.75 0 000 1.5h.25v3.25a.75.75 0 001.5 0V9.75A.75.75 0 0010 9H9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function WarningIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M9.401 3.003c.827-1.416 2.371-1.416 3.198 0l6.516 11.176c.83 1.423-.166 3.32-1.6 3.32H4.485c-1.434 0-2.43-1.897-1.6-3.32L9.4 3.003zM10 8a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 0110 8zm0 8a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0l-3.25-3.25a1 1 0 111.42-1.42l2.54 2.54 6.54-6.54a1 1 0 011.42 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function CrossIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ClockIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v4c0 .414.336.75.75.75h3a.75.75 0 000-1.5h-2.25V6.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ChevronIcon({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}
