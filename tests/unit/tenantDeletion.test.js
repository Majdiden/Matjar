/**
 * Permanent store deletion — the pure safety rails.
 *
 * The file purge deletes Cloudinary folders BY PREFIX and the data wipe
 * deletes by `{ tenantId }`; a malformed prefix or a missing id would reach
 * every store's files/rows. These tests pin that neither can happen.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tenantStoragePrefixes, localUploadPath } from "../../services/tenantFilePurge.js";
import { wipeTenantScopedData } from "../../services/tenantDeletion.js";
import { bulkDeleteConfirmationPhrase, BULK_DELETE_MAX_TENANTS, BULK_MAX_TENANTS } from "../../validators/bulk.validator.js";

describe("tenantStoragePrefixes", () => {
  it("builds one trailing-slash prefix per distinct store identifier", () => {
    const prefixes = tenantStoragePrefixes(
      { domain: "nile.matjar.to", slug: "nile", domains: { subdomain: { fullDomain: "nile.matjar.to" }, customDomain: { domain: "shop.nile.sd" } } },
      "matjar",
    );
    assert.deepEqual(prefixes.sort(), ["matjar/nile.matjar.to/", "matjar/nile/", "matjar/shop.nile.sd/"]);
  });

  it("never yields the bare base folder or a path-like prefix", () => {
    const bad = { domain: "", slug: "../x", domains: { subdomain: { fullDomain: "a/b" }, customDomain: { domain: " " } } };
    assert.deepEqual(tenantStoragePrefixes(bad, "matjar"), []);
    assert.deepEqual(tenantStoragePrefixes({ slug: "ab" }, "matjar"), [], "too short");
    assert.deepEqual(tenantStoragePrefixes({ slug: "a..b.sd" }, "matjar"), []);
    assert.deepEqual(tenantStoragePrefixes(null, "matjar"), []);
  });

  it("returns nothing without a base folder", () => {
    assert.deepEqual(tenantStoragePrefixes({ slug: "nile" }, ""), []);
    assert.deepEqual(tenantStoragePrefixes({ slug: "nile" }, "/"), []);
  });
});

describe("localUploadPath", () => {
  const root = path.resolve("/srv/app/public/uploads");
  it("maps root-relative upload urls inside the uploads root", () => {
    assert.equal(localUploadPath("/uploads/product/x.jpg", root), path.join(root, "product/x.jpg"));
  });
  it("rejects traversal, absolute and foreign urls", () => {
    assert.equal(localUploadPath("/uploads/../../etc/passwd", root), null);
    assert.equal(localUploadPath("/uploads/", root), null);
    assert.equal(localUploadPath("https://cdn.example/x.jpg", root), null);
    assert.equal(localUploadPath(undefined, root), null);
  });
});

describe("wipeTenantScopedData", () => {
  it("refuses to run without a valid tenant id (an empty filter would hit every store)", async () => {
    for (const id of [undefined, null, "", "not-an-id", "123"]) {
      await assert.rejects(() => wipeTenantScopedData(id), /invalid tenant id/);
    }
  });
});

describe("bulk delete confirmation", () => {
  it("asks for the exact count, singular or plural", () => {
    assert.equal(bulkDeleteConfirmationPhrase(1), "delete 1 store");
    assert.equal(bulkDeleteConfirmationPhrase(3), "delete 3 stores");
  });
  it("caps a bulk delete below the reversible-bulk cap", () => {
    assert.ok(BULK_DELETE_MAX_TENANTS <= BULK_MAX_TENANTS);
  });
});
