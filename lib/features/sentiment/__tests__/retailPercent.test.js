import { describe, it, expect } from "vitest";
import * as retailLongPercent from "../retailLongPercent";
import * as retailShortPercent from "../retailShortPercent";
import { historyFrom } from "./_fixtures";

const config = { range: [0, 100], staleness: { maxAgeMinutes: 180 } };

describe("retailLongPercent", () => {
  it("returns the latest reading's long percentage, normalized to -1..1", () => {
    const history = historyFrom("EURUSD", [50, 60, 65]);
    const result = retailLongPercent.compute(history, config);

    expect(result.feature).toBe("retail_long_percent");
    expect(result.value).toBe(65);
    expect(result.normalized_value).toBeCloseTo(0.3, 5);
    expect(result.confidence).toBe(1);
  });

  it("throws on empty history rather than silently returning garbage", () => {
    expect(() => retailLongPercent.compute([], config)).toThrow();
  });
});

describe("retailShortPercent", () => {
  it("returns the latest reading's short percentage, normalized to -1..1", () => {
    const history = historyFrom("EURUSD", [50, 60, 65]); // shortPercentage = 35
    const result = retailShortPercent.compute(history, config);

    expect(result.value).toBe(35);
    expect(result.normalized_value).toBeCloseTo(-0.3, 5);
  });
});
