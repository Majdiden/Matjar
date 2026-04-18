/**
 * Stub SSL provider.
 *
 * Fakes successful certificate issuance synchronously. Used in
 * development, tests, and as the default in production until a
 * real provider (Let's Encrypt, Cloudflare, etc.) is wired up.
 *
 * The "fake success" behavior matches the old enableSSLService
 * flag that D4 replaced — but now it flows through the state
 * machine and writes a real ssl subdoc on the Domain row, so
 * when a real provider gets plugged in the call sites don't
 * need to change.
 */

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export default {
  async issueCertificate({ hostname }) {
    const now = new Date();
    return {
      ok: true,
      status: "issued",
      issuedAt: now,
      // 90-day validity matches Let's Encrypt's actual default. Lets
      // the renewal worker (D5+) exercise its logic against realistic
      // expirations even in stub mode.
      expiresAt: new Date(now.getTime() + NINETY_DAYS_MS),
    };
  },

  async renewCertificate(args) {
    return this.issueCertificate(args);
  },

  async revokeCertificate() {
    return { ok: true };
  },
};
