import { describe, it, expect } from "vitest";
import * as acceleration from "../acceleration";
import { historyFrom } from "./_fixtures";

const config = {
  lookbackReadings: 4,
  maxExpectedAccelerationPerReading: 5,
  minReadingsForFullConfidence: 8,
  staleness: { maxAgeMinutes: 180 },
};

describe("acceleration", () => {
  it("is positive when buying speed is increasing", () => {
    // Slow drift (50->56 over 4), then fast rise (56->91 over next 4)
    const history = historyFrom("EURUSD", [50, 52, 54, 56, 65, 74, 82, 91]);
    const result = acceleration.compute(history, config);
    expect(result.value).toBeGreaterThan(0);
  });

  it("is negative when buying is slowing down", () => {
    // Fast rise (50->80), then slow drift (80->85)
    const history = historyFrom("EURUSD", [50, 60, 70, 80, 82, 83, 84, 85]);
    const result = acceleration.compute(history, config);
    expect(result.value).toBeLessThan(0);
  });

  it("falls back to 0 with a flag when there isn't a full prior window yet", () => {
    const shortHistory = historyFrom("EURUSD", [50, 55, 60]);
    const result = acceleration.compute(shortHistory, config);
    expect(result.value).toBe(0);
    expect(result.metadata.hasPriorWindow).toBe(false);
  });
});
