// lib/features/registry.js
// Central registry mapping a feature name -> its compute() function and
// which data source it needs. The engine (lib/features/engine.js) and the
// REST layer (app/api/features) both dispatch through this file, so adding
// a new feature is: write the module, import it here, add one line.
//
// `source` records which raw history a feature needs, so the engine knows
// which adapter's history to hand it. Today only "sentiment" (MyFXBook
// community outlook readings) is wired up; "price" will be added when the
// Massive-based features (8-19) are built.

import * as retailLongPercent from "./sentiment/retailLongPercent";
import * as retailShortPercent from "./sentiment/retailShortPercent";
import * as longDelta from "./sentiment/longDelta";
import * as shortDelta from "./sentiment/shortDelta";
import * as velocity from "./sentiment/velocity";
import * as acceleration from "./sentiment/acceleration";
import * as persistence from "./sentiment/persistence";

export const FEATURE_REGISTRY = {
  [retailLongPercent.FEATURE_NAME]: { compute: retailLongPercent.compute, source: "sentiment" },
  [retailShortPercent.FEATURE_NAME]: { compute: retailShortPercent.compute, source: "sentiment" },
  [longDelta.FEATURE_NAME]: { compute: longDelta.compute, source: "sentiment" },
  [shortDelta.FEATURE_NAME]: { compute: shortDelta.compute, source: "sentiment" },
  [velocity.FEATURE_NAME]: { compute: velocity.compute, source: "sentiment" },
  [acceleration.FEATURE_NAME]: { compute: acceleration.compute, source: "sentiment" },
  [persistence.FEATURE_NAME]: { compute: persistence.compute, source: "sentiment" },
};

/** Names of every registered feature that reads from a given source. */
export function featureNamesForSource(source) {
  return Object.entries(FEATURE_REGISTRY)
    .filter(([, def]) => def.source === source)
    .map(([name]) => name);
}

export function isRegisteredFeature(name) {
  return Object.prototype.hasOwnProperty.call(FEATURE_REGISTRY, name);
}
