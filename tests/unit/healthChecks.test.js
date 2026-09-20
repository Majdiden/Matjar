/**
 * Pure helpers of the system-health service — no DB/Redis.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { worstStatus, listIntegrations } from "../../services/platform/health.js";

describe("worstStatus", () => {
  it("rolls up to the most severe state", () => {
    assert.equal(worstStatus(["ok", "ok"]), "ok");
    assert.equal(worstStatus(["ok", "degraded"]), "degraded");
    assert.equal(worstStatus(["degraded", "down", "ok"]), "down");
    assert.equal(worstStatus(["unknown"]), "unknown");
    assert.equal(worstStatus([]), "ok");
  });
});

describe("listIntegrations", () => {
  it("never exposes configuration values, only presence + health", () => {
    const rows = listIntegrations();
    assert.ok(rows.length >= 5);
    for (const r of rows) {
      assert.equal(typeof r.configured, "boolean");
      assert.ok(["ok", "degraded", "down", "not_configured"].includes(r.health), r.name);
      const json = JSON.stringify(r).toLowerCase();
      for (const forbidden of ["secret", "apikey", "api_key", "token", "password", "redis://", "mongodb://"]) {
        assert.equal(json.includes(forbidden) && !json.includes(`"${forbidden}":false`), false, `${r.name} leaks ${forbidden}`);
      }
    }
  });
});
