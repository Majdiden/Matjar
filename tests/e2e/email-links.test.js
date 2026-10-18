/**
 * E2E: links in emails to store staff open the dashboard on the app host
 * (app.<platform domain>), not the store's own address or the bare domain.
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { startTestDb, stopTestDb, clearAllCollections } from "../helpers/db.js";
import { buildTestApp } from "../helpers/app.js";
import { getTestInbox, clearTestInbox } from "../../services/providers/email.js";
import config from "../../config/index.js";

const HOST = "acme.localhost";

/** The first link in the latest email that contains `path`. */
const linkIn = (path) => {
  const mail = getTestInbox().at(-1);
  assert.ok(mail, "an email was sent");
  const text = `${mail.html || ""} ${mail.text || ""}`;
  const m = text.match(new RegExp(`https?://[^\\s"'<>]*${path.replace(/[/?]/g, "\\$&")}[^\\s"'<>]*`));
  assert.ok(m, `no ${path} link in: ${text.slice(0, 400)}`);
  return m[0];
};

describe("E2E email links", () => {
  let app;
  before(async () => { await startTestDb(); app = buildTestApp(); });
  after(async () => { await stopTestDb(); });
  beforeEach(async () => {
    await clearAllCollections();
    clearTestInbox();
    await request(app)
      .post("/api/auth/register")
      .send({ name: "Acme", email: "owner@acme.test", password: "Sup3rSecret!", subdomain: "acme" })
      .expect(201);
    clearTestInbox();
  });

  it("a staff invitation opens on the app host, and works there without a login", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .set("Host", HOST)
      .send({ email: "owner@acme.test", password: "Sup3rSecret!", domain: HOST })
      .expect(200);
    const res = await request(app)
      .post("/api/staff/invites")
      .set("Host", HOST)
      .set("Authorization", `Bearer ${login.body.responseObject.accessToken}`)
      .send({ email: "new@acme.test", role: "staff" });
    assert.equal(res.status, 201, JSON.stringify(res.body));

    const link = linkIn("/dashboard/staff/accept?token=");
    assert.ok(link.startsWith(`${config.appOrigin}/dashboard/staff/accept?token=`), link);

    const token = new URL(link.replace(/&amp;/g, "&")).searchParams.get("token");
    await request(app).get("/api/staff/invites/verify").query({ token }).set("Host", config.appHost).expect(200);
  });

  it("a staff password reset opens on the app host", async () => {
    await request(app).post("/api/auth/password-reset").set("Host", HOST).send({ email: "owner@acme.test" }).expect(200);
    const link = linkIn("/dashboard/reset-password?token=");
    assert.ok(link.startsWith(`${config.appOrigin}/dashboard/reset-password?token=`), link);
  });
});
