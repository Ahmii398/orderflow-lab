import { describe, it, expect } from "vitest";
import * as longDelta from "../longDelta";
import * as shortDelta from "../shortDelta";
import { historyFrom } from "./_fixtures";

const config = {
  windows: { shortReadings: 5, mediumReadings: 15 },
  hourWindowMs: 3600000,
  normalizationSwingPoints: 20,
  staleness: { maxAgeMinutes: 180 },
};

describe("longDelta", () => {
  const history = historyFrom("EURUSD", [50, 55, 58, 60, 62, 65, 70]); // 7 readings, 15min apart

  it("computes the single-reading delta as the headline value", () => {
    const result = longDelta.compute(history, config);
    expect(result.value).toBe(5); // 70 - 65
  });

  it("computes 5/15-reading and ~1hr deltas in metadata", () => {
    const result = longDelta.compute(history, config);
    expect(result.metadata.delta5Readings).toBe(15); // 70 - 55
    expect(result.metadata.delta15Readings).toBeNull(); // not enough history yet
    expect(result.metadata.delta1Hour).not.toBeNull();
  });

  it("returns null (not 0) for a horizon with insufficient history", () => {
    const shortHistory = historyFrom("EURUSD", [50, 55]);
    const result = longDelta.compute(shortHistory, config);
    expect(result.metadata.delta5Readings).toBeNull();
  });

  it("reduces confidence when fewer than 2 readings exist", () => {
    const singleReading = historyFrom("EURUSD", [50]);
    const result = longDelta.compute(singleReading, config);
    expect(result.confidence).toBeLessThan(1);
  });
});

describe("shortDelta", () => {
  it("mirrors longDelta but for shortPercentage (inverse direction)", () => {
    const history = historyFrom("EURUSD", [50, 55, 58, 60, 62, 65, 70]);
    const result = shortDelta.compute(history, config);
    expect(result.value).toBe(-5); // short% fell as long% rose
  });
});
