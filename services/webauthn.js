/**
 * WebAuthn / passkey service (platform authenticator — Touch ID / Face ID /
 * Windows Hello). Wraps @simplewebauthn/server and persists credentials
 * through the tenant-scoped repository.
 *
 * Ceremony challenges are short-lived and stored in Redis (5-minute TTL) with
 * an in-memory fallback for dev without Redis:
 *   - registration: keyed by (tenantId, userId) — the user is authenticated.
 *   - authentication: keyed by a random opaque `flowId` returned to the
 *     client, so the passwordless assertion carries no user identifier the
 *     server has to trust; we look the resolved (tenantId, userId) back up
 *     from the flow record.
 *
 * Credential IDs and public keys are stored base64url-encoded — the wire
 * format @simplewebauthn returns — so they round-trip without a Buffer column.
 */

import crypto from "crypto";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { initRedis } from "../config/redis.js";
import logger from "../utils/logger.js";
import {
  listCredentialsByUserRepo,
  findUserCredentialRepo,
  createCredentialRepo,
  updateCredentialCounterRepo,
  deleteCredentialByIdRepo,
} from "../repositories/webauthnCredential.js";

const RP_NAME = "Matjar";
const CHALLENGE_TTL_SECONDS = 5 * 60;

// ── Ephemeral challenge store (Redis with in-memory fallback) ───────
const memStore = new Map();
let redisReady = null;

async function getRedis() {
  if (redisReady === false) return null;
  try {
    const client = await initRedis();
    redisReady = true;
    return client;
  } catch (err) {
    if (redisReady === null) {
      logger.warn("WebAuthn store: Redis unavailable, using in-memory store", {
        error: err?.message,
      });
    }
    redisReady = false;
    return null;
  }
}

async function kvSet(key, val, ttlSeconds) {
  const r = await getRedis();
  if (r) {
    await r.set(key, val, { EX: ttlSeconds });
    return;
  }
  memStore.set(key, { val, exp: Date.now() + ttlSeconds * 1000 });
}
async function kvGet(key) {
  const r = await getRedis();
  if (r) return r.get(key);
  const e = memStore.get(key);
  if (!e) return null;
  if (e.exp < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return e.val;
}
async function kvDel(key) {
  const r = await getRedis();
  if (r) {
    await r.del(key);
    return;
  }
  memStore.delete(key);
}

const regKey = (tenantId, userId) => `webauthn:chal:reg:${tenantId}:${userId}`;
const authKey = (flowId) => `webauthn:chal:auth:${flowId}`;

/**
 * List an authenticated user's enrolled passkeys for the dashboard Security
 * page. Returns only display-safe fields (never the public key / counter).
 */
export async function listUserPasskeys({ models, userId }) {
  const creds = await listCredentialsByUserRepo(models, userId);
  return creds.map((c) => ({
    id: String(c._id),
    name: c.name || "Passkey",
    deviceType: c.deviceType || null,
    backedUp: !!c.backedUp,
    createdAt: c.createdAt || null,
    lastUsedAt: c.lastUsedAt || null,
  }));
}

/**
 * Remove one of the user's passkeys by its Mongo _id. Scoped to the user so a
 * caller can only delete their own credentials.
 */
export async function deleteUserPasskey({ models, userId, id }) {
  const result = await deleteCredentialByIdRepo(models, userId, id);
  if (!result || result.deletedCount === 0) {
    return { success: false, statusCode: 404, message: "Passkey not found." };
  }
  return { success: true, statusCode: 200, message: "Passkey removed" };
}

/**
 * Build passkey ENROLLMENT options for an authenticated user.
 */
export async function buildRegistrationOptions({
  models,
  tenantId,
  userId,
  userName,
  userDisplayName,
  rpID,
}) {
  const existing = await listCredentialsByUserRepo(models, userId);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: Buffer.from(String(userId)),
    userName: userName || String(userId),
    userDisplayName: userDisplayName || userName || String(userId),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      // Platform authenticator = the device's built-in biometric sensor.
      authenticatorAttachment: "platform",
    },
  });

  await kvSet(regKey(tenantId, userId), options.challenge, CHALLENGE_TTL_SECONDS);
  return options;
}

/**
 * Verify an enrollment response and persist the new credential.
 */
export async function verifyRegistration({
  models,
  tenantId,
  userId,
  response,
  rpID,
  origin,
  name,
}) {
  const expectedChallenge = await kvGet(regKey(tenantId, userId));
  if (!expectedChallenge) {
    return { success: false, statusCode: 400, message: "Enrollment challenge expired. Try again." };
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    logger.warn("WebAuthn registration verification threw", { error: err?.message });
    return { success: false, statusCode: 400, message: "Could not verify passkey." };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { success: false, statusCode: 400, message: "Passkey verification failed." };
  }

  await kvDel(regKey(tenantId, userId));

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const created = await createCredentialRepo(models, {
    user: userId,
    credentialID: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
    counter: credential.counter ?? 0,
    transports: credential.transports || response?.response?.transports || [],
    deviceType: credentialDeviceType || null,
    backedUp: !!credentialBackedUp,
    name: (name && String(name).slice(0, 60)) || "Passkey",
  });

  return {
    success: true,
    statusCode: 201,
    message: "Passkey registered",
    credential: { id: String(created._id), name: created.name },
  };
}

/**
 * Build passwordless AUTHENTICATION options for a resolved (tenant, user).
 * Returns an opaque `flowId` the client echoes back at verify time.
 */
export async function buildAuthenticationOptions({ models, tenantId, userId, rpID }) {
  const creds = await listCredentialsByUserRepo(models, userId);
  if (!creds.length) {
    return { hasCredentials: false };
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    })),
    userVerification: "preferred",
  });

  const flowId = crypto.randomUUID();
  await kvSet(
    authKey(flowId),
    JSON.stringify({ challenge: options.challenge, tenantId: String(tenantId), userId: String(userId) }),
    CHALLENGE_TTL_SECONDS
  );

  return { hasCredentials: true, options, flowId };
}

/**
 * Verify a passwordless assertion. Resolves the (tenant, user) from the flow
 * record, checks the assertion against the stored credential, bumps the
 * signature counter, and returns the resolved identity for token issuance.
 *
 * `modelsForTenant(tenantId)` is a factory the controller passes so the
 * service can build a tenant-scoped models object for the tenant recorded in
 * the flow (which the client never sends).
 */
export async function verifyAuthentication({ flowId, response, rpID, origin, modelsForTenant }) {
  const raw = await kvGet(authKey(flowId));
  if (!raw) {
    return { success: false, statusCode: 400, message: "Sign-in challenge expired. Try again." };
  }

  let flow;
  try {
    flow = JSON.parse(raw);
  } catch {
    await kvDel(authKey(flowId));
    return { success: false, statusCode: 400, message: "Invalid sign-in challenge." };
  }

  const { challenge, tenantId, userId } = flow;
  const models = modelsForTenant(tenantId);

  const dbCred = await findUserCredentialRepo(models, userId, response?.id);
  if (!dbCred) {
    return { success: false, statusCode: 400, message: "Unknown passkey." };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: dbCred.credentialID,
        publicKey: Buffer.from(dbCred.publicKey, "base64url"),
        counter: dbCred.counter || 0,
        transports: dbCred.transports,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    logger.warn("WebAuthn authentication verification threw", { error: err?.message });
    return { success: false, statusCode: 400, message: "Could not verify passkey." };
  }

  if (!verification.verified) {
    return { success: false, statusCode: 401, message: "Passkey verification failed." };
  }

  await kvDel(authKey(flowId));
  await updateCredentialCounterRepo(models, dbCred.credentialID, verification.authenticationInfo.newCounter);

  return { success: true, statusCode: 200, tenantId, userId, models };
}
