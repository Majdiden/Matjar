/**
 * Email-verification OTP template.
 *
 * Mirrors the minimal transactional style used by the password-reset mailer
 * (services/emailTemplates/passwordReset.js): inline styles only, a large
 * monospace code block, an expiry line, and an "ignore this email" footer.
 *
 * Returns `{ subject, text, html }` — callers pass the shape straight to
 * services/providers/email.js::sendEmail.
 *
 * @param {object} opts
 * @param {string} opts.code               The 4-digit verification code.
 * @param {number} [opts.expiresInMinutes] Displayed to the user.
 * @param {string} [opts.language]         "ar" → Arabic copy; anything else → English.
 */
export function buildOtpVerificationEmail({ code, expiresInMinutes = 10, language }) {
  if (!code || typeof code !== "string") {
    throw new Error("buildOtpVerificationEmail: code is required");
  }

  const isAr = String(language || "").toLowerCase().startsWith("ar");

  if (isAr) {
    const subject = `${code} هو رمز التحقق الخاص بك`;
    const text = [
      "أكمل إنشاء متجرك باستخدام رمز التحقق التالي:",
      "",
      code,
      "",
      `ينتهي هذا الرمز خلال ${expiresInMinutes} دقيقة.`,
      "",
      "إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.",
    ].join("\n");
    const html = `
      <div dir="rtl" style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;text-align:right;">
        <h2 style="margin:0 0 16px 0;font-size:20px;">تأكيد بريدك الإلكتروني</h2>
        <p style="margin:0 0 16px 0;line-height:1.6;">أكمل إنشاء متجرك باستخدام رمز التحقق التالي:</p>
        <p style="margin:0 0 24px 0;text-align:center;">
          <span style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:14px 28px;font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;">${code}</span>
        </p>
        <p style="margin:0 0 24px 0;line-height:1.6;color:#555;">ينتهي هذا الرمز خلال <strong>${expiresInMinutes} دقيقة</strong>.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.</p>
      </div>
    `;
    return { subject, text, html };
  }

  const subject = `${code} is your verification code`;
  const text = [
    "Finish creating your store with this verification code:",
    "",
    code,
    "",
    `This code expires in ${expiresInMinutes} minutes.`,
    "",
    "If you didn't request this code, you can safely ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
      <h2 style="margin:0 0 16px 0;font-size:20px;">Verify your email</h2>
      <p style="margin:0 0 16px 0;line-height:1.5;">Finish creating your store with this verification code:</p>
      <p style="margin:0 0 24px 0;text-align:center;">
        <span style="display:inline-block;background:#f3f4f6;border-radius:8px;padding:14px 28px;font-size:32px;letter-spacing:8px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#111;">${code}</span>
      </p>
      <p style="margin:0 0 24px 0;line-height:1.5;color:#555;">This code expires in <strong>${expiresInMinutes} minutes</strong>.</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
      <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.5;">
        If you didn't request this code, you can safely ignore this email.
      </p>
    </div>
  `;
  return { subject, text, html };
}
