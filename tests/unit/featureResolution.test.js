/**
 * Layered feature resolution + limits ladder — pure functions, no DB.
 *   default → global → plan entitlement → program (later wins) → tenant.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveTenantLayers, isProgramActive, selectActivePrograms, selectLiveOverrides } from "../../services/featureFlags.js";
import { DEFAULT_FLAGS } from "../../config/featureFlags.js";
import { resolveLimitLayers } from "../../services/platform/usage.js";

const KEY = "payments.methods"; // boolean, default false
const LIST = "themes.allowedSlugs"; // stringList, global only

describe("resolveTenantLayers", () => {
  it("falls back to the registry default with no layers", () => {
    const { flags, layers } = resolveTenantLayers({ globalFlags: { ...DEFAULT_FLAGS } });
    assert.equal(flags[KEY], false);
    assert.equal(layers[KEY].source, "default");
  });

  it("global operator override is layer 2", () => {
    const { flags, layers } = resolveTenantLayers({ globalFlags: { ...DEFAULT_FLAGS, [KEY]: true } });
    assert.equal(flags[KEY], true);
    assert.equal(layers[KEY].source, "global");
  });

  it("plan entitlement turns a flag on above the global layer", () => {
    const { flags, layers } = resolveTenantLayers({ globalFlags: { ...DEFAULT_FLAGS }, entitlements: [KEY] });
    assert.equal(flags[KEY], true);
    assert.equal(layers[KEY].source, "plan");
    assert.equal(layers[KEY].plan, true);
  });

  it("program override beats the plan; later program wins", () => {
    const programs = [
      { key: "pilot", featureOverrides: [{ k: KEY, v: false }] },
      { key: "partner", featureOverrides: [{ k: KEY, v: true }] },
    ];
    const r = resolveTenantLayers({ globalFlags: { ...DEFAULT_FLAGS }, entitlements: [KEY], programs });
    assert.equal(r.flags[KEY], true);
    assert.equal(r.layers[KEY].source, "program");
    assert.equal(r.layers[KEY].programKey, "partner");
    const r2 = resolveTenantLayers({ globalFlags: { ...DEFAULT_FLAGS }, entitlements: [KEY], programs: [programs[0]] });
    assert.equal(r2.flags[KEY], false, "program can switch OFF an entitled flag");
  });

  it("tenant override is the final word", () => {
    const r = resolveTenantLayers({
      globalFlags: { ...DEFAULT_FLAGS, [KEY]: true },
      entitlements: [KEY],
      programs: [{ key: "pilot", featureOverrides: [{ k: KEY, v: true }] }],
      tenantOverrides: [{ key: KEY, value: false }],
    });
    assert.equal(r.flags[KEY], false);
    assert.equal(r.layers[KEY].source, "tenant");
    assert.equal(r.layers[KEY].tenant, false);
  });

  it("with two live tenant overrides for a key, the newest (first in list) wins", () => {
    const r = resolveTenantLayers({
      globalFlags: { ...DEFAULT_FLAGS },
      tenantOverrides: [
        { key: KEY, value: true, createdAt: "2026-09-20" }, // newest first, as findLiveTenantOverrides returns
        { key: KEY, value: false, createdAt: "2026-09-01" },
      ],
    });
    assert.equal(r.flags[KEY], true);
    assert.equal(r.layers[KEY].source, "tenant");
  });

  it("stringList flags are global only and ignore lower layers", () => {
    const r = resolveTenantLayers({
      globalFlags: { ...DEFAULT_FLAGS, [LIST]: ["modern"] },
      entitlements: [LIST],
      programs: [{ key: "p", featureOverrides: [{ k: LIST, v: true }] }],
      tenantOverrides: [{ key: LIST, value: true }],
    });
    assert.deepEqual(r.flags[LIST], ["modern"]);
    assert.equal(r.layers[LIST].source, "global");
  });

  it("ignores unknown keys and non-boolean values in lower layers", () => {
    const r = resolveTenantLayers({
      globalFlags: { ...DEFAULT_FLAGS },
      entitlements: ["not.a.flag"],
      programs: [{ key: "p", featureOverrides: [{ k: KEY, v: "yes" }] }],
      tenantOverrides: [{ key: KEY, value: 1 }],
    });
    assert.equal(r.flags[KEY], false);
    assert.equal(r.flags["not.a.flag"], undefined);
  });
});

describe("isProgramActive", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  it("requires status active and an open window", () => {
    assert.equal(isProgramActive({ status: "draft" }, now), false);
    assert.equal(isProgramActive({ status: "closed" }, now), false);
    assert.equal(isProgramActive({ status: "active" }, now), true);
    assert.equal(isProgramActive({ status: "active", startsAt: "2026-10-01" }, now), false);
    assert.equal(isProgramActive({ status: "active", endsAt: "2026-09-01" }, now), false);
    assert.equal(isProgramActive({ status: "active", startsAt: "2026-09-01", endsAt: "2026-10-01" }, now), true);
  });
  it("exact boundaries: startsAt === now is active, endsAt === now is inactive", () => {
    assert.equal(isProgramActive({ status: "active", startsAt: now.toISOString() }, now), true);
    assert.equal(isProgramActive({ status: "active", endsAt: now.toISOString() }, now), false);
  });
});

describe("selectActivePrograms / selectLiveOverrides", () => {
  const now = new Date("2026-09-20T00:00:00Z");
  it("drops closed / draft / out-of-window programs still listed in the membership, keeps order", () => {
    const programs = [
      { key: "closed-one", status: "closed", featureOverrides: [] },
      { key: "b", status: "active" },
      { key: "a", status: "active" },
      { key: "draft", status: "draft" },
      { key: "expired", status: "active", endsAt: "2026-09-01" },
    ];
    const r = selectActivePrograms(["a", "closed-one", "draft", "b", "expired", "missing"], programs, now);
    assert.deepEqual(r.map((p) => p.key), ["a", "b"]);
  });
  it("excludes revoked and expired overrides, keeps open-ended and future-ending ones", () => {
    const r = selectLiveOverrides(
      [
        { key: "k1", value: true, revokedAt: "2026-09-10" },
        { key: "k2", value: true, endsAt: "2026-09-19T23:59:59Z" },
        { key: "k3", value: false, endsAt: "2026-12-01" },
        { key: "k4", value: true, endsAt: null, revokedAt: null },
      ],
      now
    );
    assert.deepEqual(r.map((o) => o.key), ["k3", "k4"]);
  });
});

describe("resolveLimitLayers", () => {
  it("plan → program → tenant, null means not set", () => {
    const r = resolveLimitLayers({
      planLimits: { maxProducts: 100, maxStaff: null },
      programs: [{ key: "pilot", limitOverrides: { maxProducts: 500 } }, { key: "partner", limitOverrides: { maxStaff: 10 } }],
      tenantOverrides: { maxStaff: 3 },
    });
    assert.equal(r.maxProducts.effective, 500);
    assert.equal(r.maxProducts.source, "program");
    assert.equal(r.maxProducts.programKey, "pilot");
    assert.equal(r.maxStaff.effective, 3);
    assert.equal(r.maxStaff.source, "tenant");
    assert.equal(r.maxOrdersPerMonth.effective, null);
    assert.equal(r.maxOrdersPerMonth.source, "default");
  });
});
