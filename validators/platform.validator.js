import { z } from "zod";

/**
 * Zod schemas for the platform-admin auth + staff-management endpoints.
 * Passwords for platform staff are held to a stricter policy than merchant
 * accounts (cross-tenant blast radius): ≥ 12 chars with letters and digits.
 */

const email = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Invalid email format")
  .max(254);

export const platformPassword = z
  .string({ required_error: "Password is required" })
  .min(12, "Password must be at least 12 characters")
  .max(200)
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/\d/, "Password must include a number");

const role = z.string({ required_error: "Role is required" }).trim().toLowerCase().min(2).max(32);
const reason = z.string().trim().min(4, "Reason must be at least 4 characters").max(500);
const token = z.string({ required_error: "Token is required" }).regex(/^[a-f0-9]{64}$/, "Invalid token");

export const platformLoginSchema = z.object({
  body: z.object({ email, password: z.string({ required_error: "Password is required" }).min(1).max(200) }),
});

export const createInviteSchema = z.object({ body: z.object({ email, role }) });

export const acceptInviteSchema = z.object({
  body: z.object({
    token,
    name: z.string({ required_error: "Name is required" }).trim().min(2).max(120),
    password: platformPassword,
  }),
});

export const changeRoleSchema = z.object({ body: z.object({ role, reason: reason.optional() }) });
export const suspendUserSchema = z.object({ body: z.object({ reason }) });
// Console actions on merchant staff/invites always carry an audited reason.
export const reasonRequiredSchema = z.object({ body: z.object({ reason }) });
export const reasonOptionalSchema = z.object({ body: z.object({ reason: reason.optional() }).default({}) });

export const requestResetSchema = z.object({ body: z.object({ email }) });
export const confirmResetSchema = z.object({ body: z.object({ token, password: platformPassword }) });
export const changeOwnPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string({ required_error: "Current password is required" }).min(1).max(200),
    password: platformPassword,
  }),
});
