/** E2E: GET /api/domains/suggest-subdomains returns short, free links. */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";

describe("E2E store link suggestions", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => { await clearAllCollections(); });

  const suggest = (name) => request(app).get("/api/domains/suggest-subdomains").query({ name });

  it("suggests short links and leaves out taken ones", async () => {
    let res = await suggest("بيتنا أصل العطور السودانية").expect(200);
    assert.equal(res.body.data.suggestions[0], "bitna");

    await request(app)
      .post("/api/auth/register")
      .send({ name: "Bitna", email: "owner@bitna.test", password: "Sup3rSecret!", subdomain: "bitna" })
      .expect(201);
    res = await suggest("بيتنا أصل العطور السودانية").expect(200);
    assert.ok(!res.body.data.suggestions.includes("bitna"));
    assert.equal(res.body.data.suggestions[0], "betna");
    assert.equal(res.body.data.suggestions.length, 5);
  });

  it("needs a name", async () => {
    await suggest("").expect(400);
    await suggest("x".repeat(101)).expect(400);
  });
});
