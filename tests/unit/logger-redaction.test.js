/**
 * logger redaction — verifies that the shared logger never leaks PII or
 * secrets into stdout/stderr. This is the safety net for Sentry integration:
 * we rely on these rules to keep passwords, tokens, and customer contact
 * info out of the transport layer.
 *
 * The logger picks its output sink based on `config.isProduction`:
 *   - production: JSON line to process.stdout / process.stderr
 *   - development: pretty prefix + JSON context to console.log / console.error
 *
 * Tests run with NODE_ENV=development (from `.env`), so we capture console
 * output and parse the trailing `{...}` context JSON — this exercises the
 * same redaction pipeline either way, because redaction happens before the
 * sink branch. We also cover the `redactPII` helper directly, which is the
 * sink-agnostic entry point callers can use when building their own payloads.
 */
import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import logger, { redactPII } from "../../utils/logger.js";

/** Extract the trailing `{...}` context JSON from a dev-mode log line. */
function parseDevLine(line) {
  const idx = line.indexOf("{");
  if (idx === -1) return null;
  return JSON.parse(line.slice(idx));
}

describe("logger PII redaction", () => {
  /** @type {string[]} */
  let stdoutLines;
  /** @type {string[]} */
  let stderrLines;
  let origLog;
  let origError;

  before(() => {
    origLog = console.log;
    origError = console.error;
  });

  after(() => {
    console.log = origLog;
    console.error = origError;
  });

  beforeEach(() => {
    stdoutLines = [];
    stderrLines = [];
    console.log = (...args) => {
      stdoutLines.push(args.map(String).join(" "));
    };
    console.error = (...args) => {
      stderrLines.push(args.map(String).join(" "));
    };
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
  });

  function lastContext(stream = "stdout") {
    const lines = stream === "stderr" ? stderrLines : stdoutLines;
    assert.ok(lines.length > 0, `expected at least one ${stream} line`);
    const parsed = parseDevLine(lines[lines.length - 1]);
    assert.ok(parsed, "expected a JSON context block in log line");
    return parsed;
  }

  it("redacts top-level password field", () => {
    logger.info("login attempt", { userId: "u1", password: "hunter2" });
    const ctx = lastContext();
    assert.equal(ctx.password, "[REDACTED]");
    assert.equal(ctx.userId, "u1");
  });

  it("redacts sensitive fields in nested objects and arrays", () => {
    logger.info("context", {
      user: {
        id: "u1",
        credentials: {
          passwordHash: "$2b$10$abcdef",
          refreshToken: "rt_12345",
        },
      },
      sessions: [
        { id: "s1", accessToken: "at_abc" },
        { id: "s2", accessToken: "at_def" },
      ],
    });
    const ctx = lastContext();
    assert.equal(ctx.user.id, "u1");
    assert.equal(ctx.user.credentials.passwordHash, "[REDACTED]");
    assert.equal(ctx.user.credentials.refreshToken, "[REDACTED]");
    assert.equal(ctx.sessions[0].accessToken, "[REDACTED]");
    assert.equal(ctx.sessions[1].accessToken, "[REDACTED]");
    assert.equal(ctx.sessions[0].id, "s1");
  });

  it("redaction is case-insensitive on key names", () => {
    logger.info("casing", {
      Password: "x",
      AccessToken: "y",
      Authorization: "Bearer abc",
      SECRET: "z",
    });
    const ctx = lastContext();
    assert.equal(ctx.Password, "[REDACTED]");
    assert.equal(ctx.AccessToken, "[REDACTED]");
    assert.equal(ctx.Authorization, "[REDACTED]");
    assert.equal(ctx.SECRET, "[REDACTED]");
  });

  it("masks email as u***@domain.com", () => {
    logger.info("signup", { email: "alice@example.com" });
    const ctx = lastContext();
    assert.equal(ctx.email, "a***@example.com");
  });

  it("masks phone to last 4 digits", () => {
    logger.info("contact", { phone: "+1-555-000-1234" });
    const ctx = lastContext();
    assert.equal(ctx.phone, "****1234");
  });

  it("masks cardNumber to last 4 digits", () => {
    logger.info("checkout", { cardNumber: "4242 4242 4242 4242" });
    const ctx = lastContext();
    assert.equal(ctx.cardNumber, "****-****-****-4242");
  });

  it("redacts Authorization header when passed via nested headers object", () => {
    logger.info("incoming request", {
      method: "POST",
      path: "/api/auth/login",
      headers: {
        Authorization: "Bearer eyJhbGciOi...",
        Cookie: "sess=abc; token=xyz",
        "User-Agent": "curl/8.0",
      },
    });
    const ctx = lastContext();
    assert.equal(ctx.headers.Authorization, "[REDACTED]");
    assert.equal(ctx.headers.Cookie, "[REDACTED]");
    assert.equal(ctx.headers["User-Agent"], "curl/8.0");
    assert.equal(ctx.method, "POST");
  });

  it("leaves non-sensitive fields untouched", () => {
    logger.info("order placed", {
      orderId: "o_42",
      total: 199.99,
      currency: "USD",
      items: 3,
      customer: { id: "c_1", firstName: "Alice" },
    });
    const ctx = lastContext();
    assert.equal(ctx.orderId, "o_42");
    assert.equal(ctx.total, 199.99);
    assert.equal(ctx.currency, "USD");
    assert.equal(ctx.items, 3);
    assert.equal(ctx.customer.id, "c_1");
    assert.equal(ctx.customer.firstName, "Alice");
  });

  it("error logs go to stderr and still get redacted", () => {
    logger.error("auth failure", { apiKey: "sk_live_xxx", userId: "u9" });
    const ctx = lastContext("stderr");
    assert.equal(ctx.apiKey, "[REDACTED]");
    assert.equal(ctx.userId, "u9");
  });

  it("handles circular references without crashing", () => {
    const a = { name: "a", password: "p" };
    a.self = a;
    logger.info("circular", { root: a });
    const ctx = lastContext();
    assert.equal(ctx.root.password, "[REDACTED]");
    assert.equal(ctx.root.self, "[Circular]");
  });

  it("exposes redactPII helper with the same rules", () => {
    const scrubbed = redactPII({
      email: "bob@example.com",
      token: "t_1",
      nested: { cvv: "123", note: "ok" },
    });
    assert.equal(scrubbed.email, "b***@example.com");
    assert.equal(scrubbed.token, "[REDACTED]");
    assert.equal(scrubbed.nested.cvv, "[REDACTED]");
    assert.equal(scrubbed.nested.note, "ok");
  });
});
