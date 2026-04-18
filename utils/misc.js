import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import config from "../config/index.js";
import logger from "./logger.js";

/**
 * Sign JWT access token
 * @param {Object} data - Payload data to encode in token
 * @param {string} expiresIn - Optional expiration override
 * @returns {string} Signed JWT token
 */
const signJWT = (data, expiresIn = null) => {
  return jwt.sign(data, config.jwtSecret, {
    expiresIn: expiresIn || config.jwtExpiresIn,
  });
};

/**
 * Sign JWT refresh token
 * @param {Object} data - Payload data to encode in token
 * @returns {string} Signed JWT refresh token
 */
const signRefreshJWT = (data) => {
  return jwt.sign(data, config.jwtRefreshSecret, {
    expiresIn: config.jwtRefreshExpiresIn,
  });
};

/**
 * Verify JWT access token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
const verifyJWT = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    logger.warn(`JWT verification failed: ${error.message}`);
    return null;
  }
};

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
const verifyRefreshJWT = (token) => {
  try {
    return jwt.verify(token, config.jwtRefreshSecret);
  } catch (error) {
    logger.warn(`Refresh JWT verification failed: ${error.message}`);
    return null;
  }
};

/**
 * Generate password hash using bcrypt
 * @param {string} input - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const generateHash = async (input) => {
  try {
    const hash = await bcrypt.hash(input, config.bcryptSaltRounds);
    return hash;
  } catch (error) {
    logger.error(`Error generating hash: ${error.message}`);
    throw error;
  }
};

/**
 * Compare plain password with hashed password
 * @param {string} plainPassword - Plain text password
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if passwords match
 */
const comparePassword = async (plainPassword, hash) => {
  try {
    const match = await bcrypt.compare(plainPassword, hash);
    return match;
  } catch (error) {
    logger.error(`Error comparing password: ${error.message}`);
    throw error;
  }
};

/**
 * Mint an opaque HMAC tracking token for a guest order.
 *
 * Returned to the customer at order-placement time and required on
 * every guest order-lookup request. Binds the token to `(tenantId,
 * orderId, guestEmail)` so:
 *   - a stolen orderId alone is useless;
 *   - a token minted for one order cannot read another;
 *   - a token minted for one tenant cannot read the same orderId on
 *     another tenant's database.
 *
 * SHA-256 HMAC over a `:`-joined identifier using jwtSecret as the
 * key. The output is a 64-char hex string — 256 bits of entropy,
 * infeasible to guess.
 */
const signOrderAccessToken = ({ tenantId, orderId, email }) => {
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const payload = `${String(tenantId)}:${String(orderId)}:${normalizedEmail}`;
  return crypto
    .createHmac("sha256", config.jwtSecret)
    .update(payload)
    .digest("hex");
};

/**
 * Constant-time verification of a guest order access token.
 * Returns true iff the presented token matches the expected HMAC for
 * the given (tenantId, orderId, email) triple. Use timingSafeEqual
 * so attackers can't brute-force character-by-character.
 */
const verifyOrderAccessToken = ({ tenantId, orderId, email, token }) => {
  if (!token || typeof token !== "string") return false;
  const expected = signOrderAccessToken({ tenantId, orderId, email });
  if (expected.length !== token.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(token, "hex")
    );
  } catch (_) {
    return false;
  }
};

export {
  signJWT,
  signRefreshJWT,
  verifyJWT,
  verifyRefreshJWT,
  generateHash,
  comparePassword,
  signOrderAccessToken,
  verifyOrderAccessToken,
};
