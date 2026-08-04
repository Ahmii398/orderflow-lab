// lib/features/sentiment/persistence.js
// FEATURE 7 — Persistence
//
// Mathematical definition
//   direction(reading) = "bullish" if longPercentage > 50 + neutralBand
//                         "bearish" if longPercentage < 50 - neutralBand
//                         "neutral" otherwise
//   streak = count of consecutive readings, walking backward from the most
//            recent, that share the same direction as the latest reading
//   value = signed streak length: +streak for bullish, -streak for bearish,
//           0 for neutral
//
// Explanation
//   Measures how long sentiment has remained in one direction without
//   flipping — four bullish readings in a row scores higher persistence
//   than one bullish reading following three mixed ones, even though both
//   are "currently bullish".
//
// Output
//   normalized_value = streak rescaled by config.maxStreakForFullScore,
//   sign preserved. Confidence is intentionally reduced when the streak
//   equals the *entire* available history, since in that case we can't
//   tell whether the streak actually started there or just before our data
//   window began.

import { buildFeatureResult, clamp, freshnessConfidence } from "../base";

export const FEATURE_NAME = "persistence";

function directionOf(longPercentage, neutralBand) {
  if (longPercentage > 50 + neutralBand) return "bullish";
  if (longPercentage < 50 - neutralBand) return "bearish";
  return "neutral";
}

export function compute(history, config = {}) {
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(`${FEATURE_NAME}: no history provided`);
  }

  const neutralBand = config.neutralBandPercent ?? 5;
  const maxStreak = config.maxStreakForFullScore ?? 20;
  const latest = history[history.length - 1];

  const latestDirection = directionOf(latest.longPercentage, neutralBand);

  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const direction = directionOf(history[i].longPercentage, neutralBand);
    if (direction !== latestDirection) break;
    streak += 1;
  }

  const sign = latestDirection === "bullish" ? 1 : latestDirection === "bearish" ? -1 : 0;
  const value = sign * streak;
  const normalizedValue = clamp(sign * (streak / maxStreak), -1, 1);

  const freshness = freshnessConfidence(latest.fetchedAt, config.staleness?.maxAgeMinutes);
  // If the streak runs all the way to the start of our history, we can't
  // rule out that it started even earlier — don't let that look like full
  // confidence just because every reading we have agrees.
  const streakBoundedByHistory = streak >= history.length;
  const confidence = freshness * (streakBoundedByHistory ? 0.6 : 1);

  return buildFeatureResult({
    feature: FEATURE_NAME,
    symbol: latest.symbol,
    value,
    normalizedValue,
    confidence,
    metadata: {
      direction: latestDirection,
      streakLength: streak,
      streakBoundedByHistory,
      neutralBandPercent: neutralBand,
      readingsAvailable: history.length,
    },
    timestamp: latest.fetchedAt,
  });
}
