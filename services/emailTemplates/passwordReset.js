/**
 * Password-reset email template.
 *
 * Kept in a dedicated module so the copy + styling live in one place and
 * can be evolved without touching the sending code (services/auth.js).
 * Matches the minimal transactional style used by the staff-invite mailer
 * (see services/staff.js) — an inline <a> with a brand-colour background,
 * the raw URL fallback for clients that strip links, and a footer line
 * telling the user to ignore the email if they didn't request the reset.
 *
 * Returns `{ subject, text, html }` rather than sending the email —
 * callers pass the shape straight to services/providers/email.js::sendEmail.
 *
 * @param {object} opts
 * @param {string} opts.resetUrl     Absolute URL to the dashboard reset page
 *                                   with the raw token in the query string.
 * @param {number} [opts.expiresInMinutes=60]  Displayed to the user so they
 *                                   know how long the link stays valid.
 */
export function buildPasswordResetEmail({ resetUrl, expiresInMinutes = 60, language }) {
  if (!resetUrl || typeof resetUrl !== "string") {
    throw new Error("buildPasswordResetEmail: resetUrl is required");
  }

  const isAr = String(language || "").toLowerCase().startsWith("ar");

  if (isAr) {
    const subject = "إعادة تعيين كلمة المرور";
    const text = [
      "لقد تلقّينا طلباً لإعادة تعيين كلمة المرور لحسابك.",
      "",
      `افتح هذا الرابط لاختيار كلمة مرور جديدة (تنتهي صلاحيته خلال ${expiresInMinutes} دقيقة):`,
      resetUrl,
      "",
      "إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان — لن تتغيّر كلمة مرورك.",
    ].join("\n");
    const html = `
      <div dir="rtl" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;text-align:right;">
        <h2 style="margin:0 0 16px 0;font-size:20px;">إعادة تعيين كلمة المرور</h2>
        <p style="margin:0 0 16px 0;line-height:1.6;">لقد تلقّينا طلباً لإعادة تعيين كلمة المرور لحسابك.</p>
        <p style="margin:0 0 24px 0;line-height:1.6;">اضغط الزر أدناه لاختيار كلمة مرور جديدة. ينتهي هذا الرابط خلال <strong>${expiresInMinutes} دقيقة</strong>.</p>
        <p style="margin:0 0 24px 0;">
          <a href="${resetUrl}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:500;">إعادة تعيين كلمة المرور</a>
        </p>
        <p style="margin:0 0 8px 0;color:#555;font-size:14px;">أو انسخ هذا الرابط والصقه في متصفحك:</p>
        <p style="margin:0 0 24px 0;word-break:break-all;direction:ltr;text-align:left;">
          <code style="background:#f3f4f6;padding:4px 6px;border-radius:4px;font-size:13px;">${resetUrl}</code>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">إذا لم تطلب إعادة تعيين كلمة المرور، يمكنك تجاهل هذا البريد بأمان — لن تتغيّر كلمة مرورك.</p>
      </div>
    `;
    return { subject, text, html };
  }

  const subject = "Reset your password";

  const text = [
    "We received a request to reset the password on your account.",
    "",
    `Open this link to choose a new password (expires in ${expiresInMinutes} minutes):`,
    resetUrl,
    "",
    "If you did not request a password reset, you can safely ignore this email — your password will not change.",
  ].join("\n");

  // Minimal HTML — inline styles only so mail clients that strip <style>
  // tags still render the CTA as a button. Keep the copy identical to the
  // text body so plain-text-only clients get the same message.
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h2 style="margin:0 0 16px 0;font-size:20px;">Reset your password</h2>
      <p style="margin:0 0 16px 0;line-height:1.5;">
        We received a request to reset the password on your account.
      </p>
      <p style="margin:0 0 24px 0;line-height:1.5;">
        Click the button below to choose a new password. This link expires in
        <strong>${expiresInMinutes} minutes</strong>.
      </p>
      <p style="margin:0 0 24px 0;">
        <a href="${resetUrl}"
           style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:500;">
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px 0;color:#555;font-size:14px;">
        Or copy and paste this URL into your browser:
      </p>
      <p style="margin:0 0 24px 0;word-break:break-all;">
        <code style="background:#f3f4f6;padding:4px 6px;border-radius:4px;font-size:13px;">${resetUrl}</code>
      </p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
        If you did not request a password reset, you can safely ignore this
        email — your password will not change.
      </p>
    </div>
  `;

  return { subject, text, html };
}
