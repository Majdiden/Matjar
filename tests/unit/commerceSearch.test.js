/**
 * Pure-function coverage for the platform commerce/storefront services:
 * order timeline construction and the storefront base-URL derivation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildOrderTimeline } from "../../services/platform/commerce.js";
import { storefrontBaseUrl, isForbiddenAddress } from "../../services/platform/storefront.js";

describe("buildOrderTimeline", () => {
  it("starts with placement and orders events chronologically", () => {
    const t = buildOrderTimeline({
      createdAt: new Date("2026-09-01T10:00:00Z"),
      status: "Delivered",
      history: [
        { event: "status_changed", status: "Delivered", previousStatus: "Shipped", at: new Date("2026-09-03T09:00:00Z"), byName: "Ops" },
        { event: "status_changed", status: "Shipped", previousStatus: "Pending", at: new Date("2026-09-02T09:00:00Z") },
        { event: "note_added", note: "x".repeat(400), at: new Date("2026-09-02T10:00:00Z") },
      ],
      fulfillments: [{ history: [{ event: "created", at: new Date("2026-09-02T08:00:00Z") }] }],
      returns: [],
    });
    assert.equal(t[0].label, "Order placed");
    assert.deepEqual(t.map((i) => i.label), [
      "Order placed",
      "Fulfillment: Order placed",
      "Status → Shipped",
      "Internal note added",
      "Status → Delivered",
    ]);
    assert.equal(t[2].details.from, "Pending");
    assert.equal(t[4].actor, "Ops");
    // Notes are capped so a huge note never bloats the console payload.
    assert.equal(t[3].details.note.length, 300);
  });

  it("drops entries without a timestamp and tolerates missing arrays", () => {
    const t = buildOrderTimeline({ createdAt: new Date(), status: "Pending", history: [{ event: "weird_event" }] });
    assert.equal(t.length, 1);
  });

  it("falls back to a readable label for unknown events", () => {
    const t = buildOrderTimeline({ createdAt: new Date("2026-01-01"), history: [{ event: "gift_card.applied", at: new Date("2026-01-02") }] });
    assert.equal(t[1].label, "gift card applied");
  });
});

describe("storefrontBaseUrl", () => {
  it("uses http + :3000 for .localhost hosts (dev)", () => {
    assert.equal(storefrontBaseUrl("beauty.localhost"), "http://beauty.localhost:3000");
    assert.equal(storefrontBaseUrl("beauty.localhost:3000"), "http://beauty.localhost:3000");
    assert.equal(storefrontBaseUrl("localhost:5173"), "http://localhost:5173");
  });

  it("uses https and strips ports/schemes/paths for real hosts", () => {
    assert.equal(storefrontBaseUrl("shop.matjar.to"), "https://shop.matjar.to");
    assert.equal(storefrontBaseUrl("https://shop.matjar.to/anything"), "https://shop.matjar.to");
    assert.equal(storefrontBaseUrl("shop.matjar.to:8443"), "https://shop.matjar.to");
  });

  it("returns null without a host", () => {
    assert.equal(storefrontBaseUrl(""), null);
    assert.equal(storefrontBaseUrl(null), null);
  });
});

describe("isForbiddenAddress (SSRF guard for storefront probes)", () => {
  it("refuses loopback, private, CGNAT, link-local, metadata and multicast ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "172.31.255.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fe80::1", "fd00::1", "::ffff:10.0.0.1"]) {
      assert.equal(isForbiddenAddress(ip), true, ip);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "100.128.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      assert.equal(isForbiddenAddress(ip), false, ip);
    }
  });
  it("treats non-IP input as forbidden", () => {
    assert.equal(isForbiddenAddress("not-an-ip"), true);
  });
});
