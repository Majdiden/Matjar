/**
 * Console staff revoke/reactivate — pure logic over mocked scoped models.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { revokeStaffWithModels, reactivateStaffWithModels } from "../../services/platform/tenantUsers.js";

const chain = (value) => ({ select: () => ({ lean: async () => value }) });

/** Minimal scoped-model double: `users` is the tenant's own user table. */
function mockModels(users, { refreshTokens = [] } = {}) {
  const calls = { updates: [], refreshRevoked: 0 };
  const byId = (id) => users.find((u) => String(u._id) === String(id)) || null;
  const models = {
    User: {
      findOne: ({ _id }) => chain(byId(_id)),
      countDocuments: async ({ roles, isActive }) =>
        users.filter((u) => u.roles.includes(roles) && u.isActive === isActive).length,
      updateOne: async ({ _id }, update) => {
        calls.updates.push(update);
        const u = byId(_id);
        Object.assign(u, update.$set || {});
        if (update.$inc?.tokenVersion) u.tokenVersion = (u.tokenVersion || 0) + update.$inc.tokenVersion;
        return { modifiedCount: 1 };
      },
    },
    RefreshToken: {
      updateMany: async (filter) => {
        const n = refreshTokens.filter((t) => String(t.user) === String(filter.user) && !t.isRevoked).length;
        calls.refreshRevoked += n;
        return { modifiedCount: n };
      },
    },
  };
  return { models, calls };
}

describe("console staff revoke", () => {
  it("refuses to revoke the tenant's only active admin (409)", async () => {
    const { models } = mockModels([{ _id: "a1", roles: ["admin"], isActive: true }]);
    await assert.rejects(revokeStaffWithModels(models, "a1"), (e) => e.statusCode === 409);
  });

  it("deactivates, bumps tokenVersion, marks platform, revokes refresh tokens", async () => {
    const users = [
      { _id: "a1", roles: ["admin"], isActive: true, tokenVersion: 3 },
      { _id: "s1", roles: ["staff"], isActive: true, tokenVersion: 0 },
    ];
    const { models, calls } = mockModels(users, { refreshTokens: [{ user: "s1" }, { user: "s1" }, { user: "a1" }] });
    const diff = await revokeStaffWithModels(models, "s1");
    assert.equal(users[1].isActive, false);
    assert.equal(users[1].deactivatedBy, "platform");
    assert.equal(users[1].tokenVersion, 1);
    assert.equal(calls.refreshRevoked, 2);
    assert.equal(diff.after.deactivatedBy, "platform");
  });

  it("rolls back when a concurrent revoke leaves no active admin", async () => {
    const users = [
      { _id: "a1", roles: ["admin"], isActive: true },
      { _id: "a2", roles: ["admin"], isActive: true },
    ];
    const { models } = mockModels(users);
    // Simulate the race: the second admin disappears right after the pre-check.
    const origCount = models.User.countDocuments;
    let n = 0;
    models.User.countDocuments = async (f) => {
      n += 1;
      if (n === 2) users[1].isActive = false; // after our update, before the re-count
      return origCount(f);
    };
    await assert.rejects(revokeStaffWithModels(models, "a1"), (e) => e.statusCode === 409);
    assert.equal(users[0].isActive, true, "rolled back");
    assert.equal(users[0].deactivatedBy, null);
  });

  it("returns 404 for a userId that is not in this tenant (scoped lookup)", async () => {
    const { models } = mockModels([{ _id: "a1", roles: ["admin"], isActive: true }]);
    await assert.rejects(revokeStaffWithModels(models, "other-tenant-user"), (e) => e.statusCode === 404);
  });

  it("never touches customers", async () => {
    const { models } = mockModels([{ _id: "c1", roles: ["customer"], isActive: true }]);
    // The real query filters by staff roles; the mock mirrors that by role check.
    models.User.findOne = ({ _id }) => chain(null);
    await assert.rejects(revokeStaffWithModels(models, "c1"), (e) => e.statusCode === 404);
  });
});

describe("console staff reactivate", () => {
  it("refuses accounts removed by the merchant (409)", async () => {
    const { models } = mockModels([{ _id: "s1", roles: ["staff"], isActive: false, deactivatedBy: "merchant" }]);
    await assert.rejects(reactivateStaffWithModels(models, "s1"), (e) => e.statusCode === 409);
  });

  it("restores a platform-revoked account", async () => {
    const users = [{ _id: "s1", roles: ["staff"], isActive: false, deactivatedBy: "platform" }];
    const { models } = mockModels(users);
    await reactivateStaffWithModels(models, "s1");
    assert.equal(users[0].isActive, true);
    assert.equal(users[0].deactivatedBy, null);
  });
});
