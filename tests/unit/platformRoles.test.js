/**
 * config/platformRoles.js — pure role/scope resolution + assignment guards.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_DEFS,
  resolveEffectiveScopes,
  canAssignRole,
  canActOnRole,
  isValidRole,
} from "../../config/platformRoles.js";
import { PLATFORM_SCOPES } from "../../middlewares/platformAdmin.js";

describe("platform roles", () => {
  it("every role only references known scopes and owner holds all of them", () => {
    const known = new Set(Object.values(PLATFORM_SCOPES));
    for (const def of PLATFORM_ROLE_DEFS) {
      for (const s of def.scopes) assert.ok(known.has(s), `${def.key} has unknown scope ${s}`);
    }
    const owner = PLATFORM_ROLE_DEFS.find((r) => r.key === PLATFORM_ROLES.OWNER);
    assert.equal(owner.scopes.length, known.size);
  });

  it("resolves effective scopes = role ∪ explicit grants, ignoring unknown grants", () => {
    const scopes = resolveEffectiveScopes(PLATFORM_ROLES.SUPPORT, ["tenant.export", "bogus.scope"]);
    assert.ok(scopes.includes("support.read"));
    assert.ok(scopes.includes("tenant.export"));
    assert.ok(!scopes.includes("bogus.scope"));
    assert.equal(new Set(scopes).size, scopes.length);
  });

  it("legacy users without a role keep their explicit scopes", () => {
    assert.deepEqual(resolveEffectiveScopes(null, ["billing.read"]), ["billing.read"]);
    assert.deepEqual(resolveEffectiveScopes(undefined, []), []);
  });

  it("only an owner may grant the owner role; admins grant everything below", () => {
    assert.equal(canAssignRole("owner", "owner"), true);
    assert.equal(canAssignRole("admin", "owner"), false);
    assert.equal(canAssignRole("admin", "admin"), true);
    assert.equal(canAssignRole("admin", "support"), true);
    assert.equal(canAssignRole("support", "support"), false);
    assert.equal(canAssignRole("owner", "not-a-role"), false);
    assert.equal(canAssignRole(null, "support"), false);
  });

  it("admins cannot act on owners; owners can act on anyone", () => {
    assert.equal(canActOnRole("admin", "owner"), false);
    assert.equal(canActOnRole("admin", "admin"), true);
    assert.equal(canActOnRole("owner", "owner"), true);
    assert.equal(canActOnRole("finance", "support"), false);
  });

  it("validates role keys case-insensitively", () => {
    assert.equal(isValidRole("OWNER"), true);
    assert.equal(isValidRole("root"), false);
  });
});

describe("platform roles — case normalisation (privilege-escalation guard)", () => {
  it("an admin cannot grant OWNER through a differently-cased role string", () => {
    assert.equal(canAssignRole("admin", "OWNER"), false);
    assert.equal(canAssignRole("admin", "Owner"), false);
    assert.equal(canAssignRole("ADMIN", "owner"), false);
    assert.equal(canActOnRole("admin", "OWNER"), false);
    assert.equal(canAssignRole("OWNER", "Owner"), true);
  });
});
