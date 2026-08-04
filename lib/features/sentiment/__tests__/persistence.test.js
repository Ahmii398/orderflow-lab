import { describe, it, expect } from "vitest";
import * as persistence from "../persistence";
import { historyFrom } from "./_fixtures";

const config = { neutralBandPercent: 5, maxStreakForFullScore: 20, staleness: { maxAgeMinutes: 180 } };

describe("persistence", () => {
  it("counts a run of consecutive bullish readings as a positive streak", () => {
    const history = historyFrom("EURUSD", [52, 60, 61, 62, 63]); // 52 is neutral (within band), rest bullish
    const result = persistence.compute(history, config);

    expect(result.metadata.direction).toBe("bullish");
    expect(result.metadata.streakLength).toBe(4);
    expect(result.value).toBe(4);
  });

  it("counts a run of consecutive bearish readings as a negative streak", () => {
    const history = historyFrom("EURUSD", [50, 40, 38, 35]);
    const result = persistence.compute(history, config);

    expect(result.metadata.direction).toBe("bearish");
    expect(result.value).toBe(-3);
  });

  it("resets the streak the moment direction flips", () => {
    const history = historyFrom("EURUSD", [70, 71, 72, 40]); // was bullish, now bearish
    const result = persistence.compute(history, config);

    expect(result.metadata.direction).toBe("bearish");
    expect(result.metadata.streakLength).toBe(1);
  });

  it("flags when the streak spans the entire available history (can't rule out it started earlier)", () => {
    const history = historyFrom("EURUSD", [60, 61, 62]);
    const result = persistence.compute(history, config);

    expect(result.metadata.streakBoundedByHistory).toBe(true);
    expect(result.confidence).toBeLessThan(1);
  });
});
