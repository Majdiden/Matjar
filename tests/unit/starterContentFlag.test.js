/**
 * Starter-content feature flag — registry contract + service constants.
 *
 * The seeding step itself needs Mongo (covered by the signup e2e); here we
 * pin the things the platform-admin UI and the setup pipeline both rely on:
 * the flag exists, is boolean, defaults OFF, and the pipeline references the
 * same key.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FLAGS, getFlagDef } from "../../config/featureFlags.js";
import { STARTER_CONTENT_FLAG, STARTER_CONTENT_DISABLED_REASON } from "../../services/storeSetup.js";

describe("onboarding.starterContent flag", () => {
  it("is registered as a boolean that defaults to OFF", () => {
    const def = getFlagDef("onboarding.starterContent");
    assert.ok(def, "flag missing from FEATURE_REGISTRY");
    assert.equal(def.type, "boolean");
    assert.equal(def.default, false);
    assert.equal(DEFAULT_FLAGS["onboarding.starterContent"], false);
  });

  it("is the key the setup pipeline gates on", () => {
    assert.equal(STARTER_CONTENT_FLAG, "onboarding.starterContent");
    assert.ok(STARTER_CONTENT_DISABLED_REASON.length > 0);
  });
});
