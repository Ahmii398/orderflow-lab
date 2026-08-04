import { describe, it, expect } from "vitest";
import { clamp, normalizeLinear, safeDiv, linearRegressionSlope, freshnessConfidence, sampleSizeConfidence } from "../base";

describe("clamp", () => {
  it("clamps values outside the range", () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.5, -1, 1)).toBe(0.5);
  });
});

describe("normalizeLinear", () => {
  it("maps the midpoint to 0 and the endpoints to -1/+1", () => {
    expect(normalizeLinear(50, 0, 100, -1, 1)).toBe(0);
    expect(normalizeLinear(0, 0, 100, -1, 1)).toBe(-1);
    expect(normalizeLinear(100, 0, 100, -1, 1)).toBe(1);
  });

  it("clamps values outside the input range instead of overshooting", () => {
    expect(normalizeLinear(150, 0, 100, -1, 1)).toBe(1);
    expect(normalizeLinear(-50, 0, 100, -1, 1)).toBe(-1);
  });
});

describe("safeDiv", () => {
  it("returns the fallback instead of NaN/Infinity on divide-by-zero", () => {
    expect(safeDiv(10, 0, 0)).toBe(0);
    expect(safeDiv(10, 2)).toBe(5);
  });
});

describe("linearRegressionSlope", () => {
  it("gives a steeper slope for a faster-moving series (spec's own example)", () => {
    const low = linearRegressionSlope([60, 61, 62, 63]);
    const high = linearRegressionSlope([60, 70, 82, 91]);
    expect(high.slope).toBeGreaterThan(low.slope);
  });

  it("returns r2 of 1 for a perfectly linear series", () => {
    const { r2 } = linearRegressionSlope([10, 20, 30, 40]);
    expect(r2).toBeCloseTo(1, 5);
  });
});

describe("freshnessConfidence", () => {
  it("is full confidence when the reading is within the max age", () => {
    const now = new Date().toISOString();
    expect(freshnessConfidence(now, 180)).toBe(1);
  });

  it("decays for stale readings", () => {
    const stale = new Date(Date.now() - 300 * 60000).toISOString(); // 300 min ago
    expect(freshnessConfidence(stale, 180)).toBeLessThan(1);
  });
});

describe("sampleSizeConfidence", () => {
  it("scales with how much of the required sample is available", () => {
    expect(sampleSizeConfidence(5, 5)).toBe(1);
    expect(sampleSizeConfidence(2, 4)).toBe(0.5);
    expect(sampleSizeConfidence(10, 5)).toBe(1); // never exceeds 1
  });
});
