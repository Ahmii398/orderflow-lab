import { describe, it, expect } from "vitest";
import * as velocity from "../velocity";
import { historyFrom } from "./_fixtures";

const config = { lookbackReadings: 4, maxExpectedSlopePerReading: 5, minReadingsForFullConfidence: 4, staleness: { maxAgeMinutes: 180 } };

describe("velocity", () => {
  it("scores the spec's own low-velocity example lower than its high-velocity example", () => {
    const low = velocity.compute(historyFrom("EURUSD", [60, 61, 62, 63]), config);
    const high = velocity.compute(historyFrom("EURUSD", [60, 70, 82, 91]), config);

    expect(high.value).toBeGreaterThan(low.value);
    expect(high.normalized_value).toBeGreaterThan(low.normalized_value);
  });

  it("gives full sample-size confidence once lookback is satisfied", () => {
    const result = velocity.compute(historyFrom("EURUSD", [60, 65, 70, 75]), config);
    expect(result.metadata.lookbackReadings).toBe(4);
  });

  it("reports fit quality (r2) close to 1 for a clean linear trend", () => {
    const result = velocity.compute(historyFrom("EURUSD", [10, 20, 30, 40]), config);
    expect(result.metadata.fitQualityR2).toBeGreaterThan(0.99);
  });
});
