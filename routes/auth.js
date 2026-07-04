import { Router } from "express";
import {
  registerTenantController,
  addStoreController,
  checkEmailController,
  loginController,
  refreshTokenController,
  getCurrentUserController,
  logoutController,
  changePasswordController,
  requestPasswordResetController,
  confirmPasswordResetController,
  requestOtpController,
  verifyOtpController,
  requestEmailVerificationController,
  confirmEmailVerificationController,
} from "../controllers/auth.js";
import {
  registrationOptionsController,
  verifyRegistrationController,
  authenticationOptionsController,
  verifyAuthenticationController,
  listCredentialsController,
  deleteCredentialController,
} from "../controllers/webauthn.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  passwordResetLimiter,
  passwordResetEmailLimiter,
  createRateLimiter,
} from "../middlewares/rateLimiters.js";
import {
  registerTenantSchema,
  loginSchema,
  refreshTokenSchema,
  requestPasswordResetSchema,
  confirmPasswordResetSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from "../validators/auth.validator.js";

const authRoutes = Router();

// ─── Email-OTP rate limiters ────────────────────────────────────────
// Per-IP ceilings on top of the per-email cooldown/cap enforced in
// services/otp.js. Request is the abuse-sensitive one (sends mail); verify
// is throttled to blunt brute-forcing the 4-digit code from one host.
const MINUTE = 60 * 1000;
const otpRequestLimiter = createRateLimiter({
  prefix: "otp:request",
  windowMs: 15 * MINUTE,
  max: 20,
  message: "Too many verification-code requests. Please try again shortly.",
});
const otpVerifyLimiter = createRateLimiter({
  prefix: "otp:verify",
  windowMs: 15 * MINUTE,
  max: 40,
  message: "Too many verification attempts. Please try again shortly.",
});
// Passkey login ceremony — per-IP ceiling on both options + verify.
const webauthnAuthLimiter = createRateLimiter({
  prefix: "webauthn:auth",
  windowMs: 15 * MINUTE,
  max: 60,
  message: "Too many passkey sign-in attempts. Please try again shortly.",
});

// Public routes
authRoutes.post("/register", validate(registerTenantSchema), registerTenantController);
authRoutes.get("/check-email", checkEmailController);
authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.post("/refresh", validate(refreshTokenSchema), refreshTokenController);

// ─── Email-OTP verification (public, used during signup) ───────────
authRoutes.post("/otp/request", otpRequestLimiter, validate(requestOtpSchema), requestOtpController);
authRoutes.post("/otp/verify", otpVerifyLimiter, validate(verifyOtpSchema), verifyOtpController);

// ─── WebAuthn passwordless authentication (public) ─────────────────
// Passwordless login with a previously-enrolled passkey (fingerprint /
// Face ID). Options resolves the tenant/user from the email; verify checks
// the assertion and mints a normal session.
authRoutes.post("/webauthn/authenticate-options", webauthnAuthLimiter, authenticationOptionsController);
authRoutes.post("/webauthn/authenticate-verify", webauthnAuthLimiter, verifyAuthenticationController);

// Public forgot-password. Both limiters stack intentionally: the IP
// bucket (`passwordResetLimiter`) stops a single host from hammering the
// endpoint; the email bucket (`passwordResetEmailLimiter`) stops a
// distributed attacker from flooding one inbox or burning through a
// victim's reset attempts from many IPs.
authRoutes.post(
  "/password-reset",
  passwordResetLimiter,
  passwordResetEmailLimiter,
  validate(requestPasswordResetSchema),
  requestPasswordResetController,
);
authRoutes.post(
  "/password-reset/confirm",
  passwordResetLimiter,
  validate(confirmPasswordResetSchema),
  confirmPasswordResetController,
);

// Protected routes
// Authenticated "add another store" — an existing user creates a new store
// under their account (reuses their credentials; returns a token for the
// new store so the client hands them straight in).
authRoutes.post("/stores", authenticate, addStoreController);

// WebAuthn passkey ENROLLMENT — a signed-in user registers a platform
// authenticator (fingerprint / Face ID) on their account.
authRoutes.post("/webauthn/register-options", authenticate, registrationOptionsController);
authRoutes.post("/webauthn/register-verify", authenticate, verifyRegistrationController);

// WebAuthn credential management — the dashboard Security page lists a
// signed-in user's enrolled passkeys and lets them remove one.
authRoutes.get("/webauthn/credentials", authenticate, listCredentialsController);
authRoutes.delete("/webauthn/credentials/:id", authenticate, deleteCredentialController);

// Authenticated email verification (dashboard Security page). Operates on the
// signed-in user's own email; on confirm it flips the durable emailVerified
// flag. Reuses the per-IP OTP limiters so it can't be used to spam mail.
authRoutes.post(
  "/email/verify-request",
  authenticate,
  otpRequestLimiter,
  requestEmailVerificationController
);
authRoutes.post(
  "/email/verify-confirm",
  authenticate,
  otpVerifyLimiter,
  confirmEmailVerificationController
);

authRoutes.get("/me", authenticate, getCurrentUserController);
authRoutes.post("/logout", authenticate, logoutController);
authRoutes.post("/change-password", passwordResetLimiter, authenticate, changePasswordController);

export default authRoutes;
