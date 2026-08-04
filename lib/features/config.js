// lib/features/config.js
// Loads per-feature configuration from config/features.json. Feature
// modules must always read their parameters through getFeatureConfig() —
// never hardcode a threshold/window/scaling constant inline — so tuning a
// feature is a config-file change, not a code change.

import featuresConfig from "@/config/features.json";

/**
 * Returns the configuration object for a given feature name, or {} if none
 * is defined (so a feature with no tunables yet doesn't need an entry).
 *
 * @param {string} featureName - e.g. "velocity"
 * @returns {object}
 */
export function getFeatureConfig(featureName) {
  return featuresConfig[featureName] || {};
}

/** Returns the full config object — mainly useful for tests/debugging. */
export function getAllFeatureConfig() {
  return featuresConfig;
}
