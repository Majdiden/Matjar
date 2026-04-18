import config from "../config/index.js";

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[config.logLevel] || LEVELS.info;

// ---------------------------------------------------------------------------
// PII redaction
// ---------------------------------------------------------------------------
// Applied to every log call so we never leak secrets or customer PII into
// stdout/stderr (and, downstream, Sentry). This is a prerequisite for turning
// on Sentry — we don't want to ship PII on day one. Redaction happens at the
// logger boundary so callers don't need to remember to sanitise ad-hoc.
//
// The rules are:
//   - REDACT_KEYS are replaced with the string "[REDACTED]" (full drop).
//   - MASK_KEYS keep a small non-sensitive tail so logs stay debuggable:
//       email       -> u***@domain.com
//       phone       -> ****1234 (last 4)
//       cardNumber  -> ****-****-****-1234 (last 4)
//   - Matching is case-insensitive on the key name.
//   - Traversal is recursive across nested objects and arrays.
//   - Cycles are handled via a WeakSet so a Mongoose doc with circular refs
//     can't hang or OOM the process.
//   - Non-plain objects (Error, Date, Buffer, Map/Set, Mongoose docs) are
//     coerced to a safe representation rather than walked.

const REDACT_KEYS = new Set(
  [
    "password",
    "passwordHash",
    "token",
    "accessToken",
    "refreshToken",
    "authorization",
    "cookie",
    "setCookie",
    "apiKey",
    "secret",
    "creditCard",
    "cvv",
    "cvc",
    "ssn",
  ].map((k) => k.toLowerCase())
);

const MASK_KEYS = new Set(["email", "phone", "cardnumber"]);

const REDACTED = "[REDACTED]";

function maskEmail(value) {
  if (typeof value !== "string") return value;
  const at = value.indexOf("@");
  if (at <= 0) return REDACTED; // not an email shape — redact entirely
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  const head = local[0] || "";
  return `${head}***@${domain}`;
}

function maskPhone(value) {
  if (value == null) return value;
  const str = String(value);
  const digits = str.replace(/\D/g, "");
  if (digits.length <= 4) return REDACTED;
  return `****${digits.slice(-4)}`;
}

function maskCardNumber(value) {
  if (value == null) return value;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return REDACTED;
  return `****-****-****-${digits.slice(-4)}`;
}

function maskByKey(keyLower, value) {
  if (keyLower === "email") return maskEmail(value);
  if (keyLower === "phone") return maskPhone(value);
  if (keyLower === "cardnumber") return maskCardNumber(value);
  return value;
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function redact(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean" || t === "bigint") {
    return value;
  }
  if (t === "function" || t === "symbol") {
    return String(value);
  }

  // Errors: preserve message + stack, redact any attached context.
  if (value instanceof Error) {
    const out = { name: value.name, message: value.message, stack: value.stack };
    for (const k of Object.keys(value)) {
      out[k] = redactField(k, value[k], seen);
    }
    return out;
  }

  if (value instanceof Date) return value.toISOString();
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length}B]`;
  }
  if (value instanceof Map) {
    const out = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = redactField(String(k), v, seen);
    }
    return out;
  }
  if (value instanceof Set) {
    return Array.from(value, (v) => redact(v, seen));
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((v) => redact(v, seen));
  }

  // Non-plain objects (e.g. Mongoose docs) — walk enumerable own keys only
  // so we don't explode on internal `$`-prefixed metadata. Keys still get
  // redaction applied.
  const out = {};
  const target = isPlainObject(value) ? value : Object.assign({}, value);
  for (const k of Object.keys(target)) {
    out[k] = redactField(k, target[k], seen);
  }
  return out;
}

function redactField(key, value, seen) {
  const kl = String(key).toLowerCase();
  if (REDACT_KEYS.has(kl)) return REDACTED;
  if (MASK_KEYS.has(kl)) {
    // Masks apply to scalar values; if a nested object sneaks in under an
    // `email` field for some reason, walk it defensively.
    if (value !== null && typeof value === "object") {
      return redact(value, seen);
    }
    return maskByKey(kl, value);
  }
  return redact(value, seen);
}

// Public helper — exposed so tests and callers that build their own structured
// payloads can scrub a value with the same rules the logger uses.
export function redactPII(value) {
  return redact(value);
}

function redactMessage(message) {
  if (typeof message !== "string") {
    // A non-string `message` is unusual but we still want it scrubbed.
    try {
      return JSON.stringify(redact(message));
    } catch {
      return String(message);
    }
  }
  return message;
}

function log(level, message, context = {}) {
  if (LEVELS[level] < currentLevel) return;

  const safeMessage = redactMessage(message);
  const safeContext = context && typeof context === "object" ? redact(context) : context;

  const entry = {
    level,
    message: safeMessage,
    timestamp: new Date().toISOString(),
    ...(safeContext && typeof safeContext === "object" ? safeContext : {}),
  };

  if (config.isProduction) {
    const stream = level === "error" ? process.stderr : process.stdout;
    stream.write(JSON.stringify(entry) + "\n");
  } else {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    const ctxKeys = safeContext && typeof safeContext === "object" ? Object.keys(safeContext) : [];
    const ctx = ctxKeys.length ? ` ${JSON.stringify(safeContext)}` : "";
    const stream = level === "error" ? console.error : console.log;
    stream(`${prefix} ${safeMessage}${ctx}`);
  }
}

export const logger = {
  debug: (msg, ctx) => log("debug", msg, ctx),
  info: (msg, ctx) => log("info", msg, ctx),
  warn: (msg, ctx) => log("warn", msg, ctx),
  error: (msg, ctx) => log("error", msg, ctx),
};

export default logger;
