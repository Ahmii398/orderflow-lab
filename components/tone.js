// components/tone.js
// Shared helper for mapping a signal's `interpretation` string to a
// bullish/bearish/neutral "tone" used for badge colors throughout the
// dashboard. Mirrors the isBullish()/isBearish() keyword logic in
// lib/db/logger.js so the UI's color-coding always agrees with the
// accuracy math happening on the backend.

export function getTone(interpretation) {
  const text = (interpretation || "").toLowerCase();
  if (text.includes("bull")) return "bullish";
  if (text.includes("bear")) return "bearish";
  return "neutral";
}

export const TONE_BADGE_CLASSES = {
  bullish: "bg-bullish-soft text-bullish",
  bearish: "bg-bearish-soft text-bearish",
  neutral: "bg-neutral-soft text-neutral",
};
