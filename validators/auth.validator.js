import { z } from "zod";

/**
 * Validation schemas for authentication endpoints
 */

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email format"),
    password: z
      .string({ required_error: "Password is required" })
      .min(6, "Password must be at least 6 characters"),
    // Optional: caller passes tenantId when their email is attached
    // to more than one store and they've picked one from the selector.
    // `domain` is still accepted for backward compatibility with any
    // client that hasn't migrated yet.
    tenantId: z.string().optional(),
    domain: z.string().optional(),
  }),
});

export const registerTenantSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: "Name is required",
      })
      .min(2, "Name must be at least 2 characters"),
    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format"),
    password: z
      .string({
        required_error: "Password is required",
      })
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    subdomain: z
      .string({
        required_error: "Domain is required",
      })
      .min(3, "Domain must be at least 3 characters")
      .regex(
        /^[a-z0-9-]+$/,
        "Domain must contain only lowercase letters, numbers, and hyphens"
      ),
    // The store's display name (distinct from the user's `name`). Optional
    // for backward compatibility — the service falls back to `name`.
    storeName: z.string().min(2, "Store name must be at least 2 characters").optional(),
    // Passed through to store setup; not required.
    themeSlug: z.string().optional(),
    niche: z.string().optional(),
    subscriptionPlan: z.string().optional(),
    // Onboarding: false when the user skipped the theme step (default theme
    // is still applied). Defaults to true server-side when omitted.
    themeSelected: z.boolean().optional(),
    // Proof-of-email-verification token minted by POST /auth/otp/verify. The
    // register controller validates it against `email` when present.
    emailVerificationToken: z.string().optional(),
  }),
});

// ─── Email-OTP validators ──────────────────────────────────────────

export const requestOtpSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email format"),
    // Optional UI language so the OTP email matches the dashboard locale.
    language: z.string().max(10).optional(),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email format"),
    code: z
      .string({ required_error: "Code is required" })
      .regex(/^\d{4}$/, "Code must be 4 digits"),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({
        required_error: "Refresh token is required",
      })
      .min(1, "Refresh token cannot be empty"),
  }),
});

// ─── Forgot-password validators ────────────────────────────────────────
//
// Password policy on RESET intentionally matches the task spec:
// min 8 chars, at least one letter and one digit. We accept this as
// slightly looser than the register schema (which also requires mixed
// case) because change-password and reset-password share a policy
// across the app — the register path is stricter only because it's the
// one chance we get to set a baseline for a brand-new account.

const HEX_TOKEN_RE = /^[a-f0-9]{64}$/;

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email format"),
  }),
});

export const confirmPasswordResetSchema = z.object({
  body: z.object({
    // 32-byte token encoded as hex → 64 chars. Anything else is
    // malformed; we reject before the service touches the DB.
    token: z
      .string({ required_error: "Token is required" })
      .regex(HEX_TOKEN_RE, "Invalid reset token"),
    newPassword: z
      .string({ required_error: "New password is required" })
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include at least one letter")
      .regex(/\d/, "Password must include at least one number"),
  }),
});
