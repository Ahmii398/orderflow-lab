import { describe, it, expect } from "vitest";
import { computeSentimentFeatures } from "../engine";
import { FEATURE_REGISTRY } from "../registry";
import { historyFrom } from "../sentiment/__tests__/_fixtures";

describe("computeSentimentFeatures", () => {
  it("computes every registered sentiment feature and keys results by feature name", () => {
    const history = historyFrom("EURUSD", [50, 55, 58, 60, 62, 65, 70]);
    const results = computeSentimentFeatures("EURUSD", history);

    for (const featureName of Object.keys(FEATURE_REGISTRY)) {
      expect(results).toHaveProperty(featureName);
      expect(results[featureName]).not.toBeNull();
      expect(results[featureName].symbol).toBe("EURUSD");
    }
  });

  it("isolates a failing feature instead of aborting the whole batch", () => {
    // Empty history makes every feature module throw (each requires >=1 reading) —
    // the engine should catch each and report null rather than throwing itself.
    const results = computeSentimentFeatures("EURUSD", []);

    for (const featureName of Object.keys(FEATURE_REGISTRY)) {
      expect(results[featureName]).toBeNull();
    }
  });
});
