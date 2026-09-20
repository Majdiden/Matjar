/**
 * Platform-staff sessions — one PlatformSession row per issued token (jti).
 *
 * `platformAuthenticate` calls `isSessionActive(jti)` on every request; the
 * lookup is indexed and results are cached for 30 s per jti (revocations
 * therefore take effect within 30 s — the tokenVersion bump remains the
 * instant "revoke everything" path).
 */
import crypto from "crypto";
import mongoose from "mongoose";
import { APIError } from "../../middlewares/errorHandler.js";

const CACHE_TTL_MS = 30_000;
const MAX_CACHE = 5000;
const cache = new Map(); // jti -> { active, at }

const PlatformSession = () => mongoose.model("PlatformSession");

export function newJti() {
  return crypto.randomBytes(16).toString("hex");
}

export async function createSession({ userId, jti, req, expiresAt, mfaVerified = false }) {
  await PlatformSession().create({
    userId,
    jti,
    ip: req?.ip || null,
    userAgent: req?.headers?.["user-agent"]?.slice(0, 300) || null,
    mfaVerified,
    expiresAt,
  });
  cache.set(jti, { active: true, at: Date.now() });
}

/** True when the session row exists and is not revoked. Missing row → false. */
export async function isSessionActive(jti) {
  if (!jti) return false;
  const hit = cache.get(jti);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.active;
  const row = await PlatformSession().findOne({ jti }).select("revokedAt expiresAt").lean();
  const active = !!row && !row.revokedAt && row.expiresAt > new Date();
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(jti, { active, at: Date.now() });
  return active;
}

/** Best-effort `lastSeenAt` bump, throttled to once per minute per session. */
const lastTouch = new Map();
export function touchSession(jti) {
  if (!jti) return;
  const now = Date.now();
  if ((lastTouch.get(jti) || 0) > now - 60_000) return;
  lastTouch.set(jti, now);
  if (lastTouch.size >= MAX_CACHE) lastTouch.clear();
  PlatformSession()
    .updateOne({ jti }, { $set: { lastSeenAt: new Date() } })
    .catch(() => {});
}

export function publicSession(s, currentJti = null) {
  return {
    id: String(s._id),
    ip: s.ip,
    userAgent: s.userAgent,
    mfaVerified: !!s.mfaVerified,
    createdAt: s.createdAt,
    lastSeenAt: s.lastSeenAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    current: !!currentJti && s.jti === currentJti,
  };
}

export async function listSessions(userId, { currentJti = null, includeRevoked = false } = {}) {
  const filter = { userId };
  if (!includeRevoked) filter.revokedAt = null;
  const rows = await PlatformSession().find(filter).sort({ lastSeenAt: -1 }).limit(50).lean();
  const now = new Date();
  return rows.filter((r) => includeRevoked || r.expiresAt > now).map((r) => publicSession(r, currentJti));
}

/** Revoke one session by id, scoped to `userId` so nobody can revoke across users by guessing ids. */
export async function revokeSession({ userId, sessionId, reason = null }) {
  const row = await PlatformSession().findOneAndUpdate(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
    { new: true }
  ).lean();
  if (!row) throw new APIError("Session not found or already revoked", 404);
  cache.set(row.jti, { active: false, at: Date.now() });
  return publicSession(row);
}

/** Revoke every session of a user (used alongside the tokenVersion bump). */
export async function revokeAllSessions(userId, reason = null, { exceptJti = null } = {}) {
  const filter = { userId, revokedAt: null };
  if (exceptJti) filter.jti = { $ne: exceptJti };
  const res = await PlatformSession().updateMany(filter, { $set: { revokedAt: new Date(), revokedReason: reason } });
  // Drop cached "active" entries; they will re-resolve as revoked.
  for (const [jti, v] of cache) if (v.active && jti !== exceptJti) cache.delete(jti);
  return res.modifiedCount || 0;
}

export function __clearSessionCache() {
  cache.clear();
  lastTouch.clear();
}
