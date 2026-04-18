import { Schema } from "mongoose";

/**
 * Domain Registry
 * ---------------
 * First-class resource representing a hostname attached to a tenant.
 * Replaces the embedded `tenant.domains.{subdomain,customDomain}` subtree.
 *
 * A tenant can own many domains (platform subdomain, custom apex, `www`,
 * regional brand domains, staging). Exactly one per tenant is flagged
 * `isPrimary` — that's the canonical host the storefront redirects to.
 *
 * Lifecycle (see STATUSES):
 *   pending_dns        → just created, waiting for merchant to add DNS
 *   ownership_verified → TXT proved they control the domain
 *   dns_verified       → CNAME/A resolves to our edge
 *   provisioning_ssl   → cert job in flight
 *   active             → serving traffic
 *   ssl_failed         → cert issuance failed, retryable
 *   dns_misconfigured  → DNS drifted after going active, operator attention
 *   disabled           → merchant removed or platform disabled
 *
 * Platform-subdomain rows (`kind: "platform_subdomain"`) skip ownership/DNS
 * verification — the platform owns the parent zone — and jump straight to
 * `active` on create.
 */

export const DOMAIN_KINDS = Object.freeze({
  PLATFORM_SUBDOMAIN: "platform_subdomain",
  CUSTOM_APEX: "custom_apex",
  CUSTOM_SUBDOMAIN: "custom_subdomain",
});

export const DOMAIN_STATUSES = Object.freeze({
  PENDING_DNS: "pending_dns",
  OWNERSHIP_VERIFIED: "ownership_verified",
  DNS_VERIFIED: "dns_verified",
  PROVISIONING_SSL: "provisioning_ssl",
  ACTIVE: "active",
  SSL_FAILED: "ssl_failed",
  DNS_MISCONFIGURED: "dns_misconfigured",
  DISABLED: "disabled",
});

const domainSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },

    // Fully-qualified hostname, lowercased, punycode-encoded for IDNs,
    // no trailing dot, no port. Globally unique across all tenants —
    // we can't have two stores claiming the same host.
    hostname: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    kind: {
      type: String,
      enum: Object.values(DOMAIN_KINDS),
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(DOMAIN_STATUSES),
      default: DOMAIN_STATUSES.PENDING_DNS,
      index: true,
    },

    // Exactly one domain per tenant may be isPrimary=true. Enforced at
    // the service layer (single-writer mutation) rather than a partial
    // unique index because MongoDB's partial indexes can't express
    // "unique within tenantId scope where isPrimary=true" cleanly
    // across all engines we target.
    isPrimary: { type: Boolean, default: false, index: true },

    // Ownership proof (TXT record).
    //
    // Note on "secrecy": the TXT record value is published by the
    // merchant in public DNS, so it is NOT a secret — anyone can
    // query the record. We therefore store it as plaintext and
    // treat it as non-sensitive. `tokenHash` is retained for
    // backwards compatibility with pre-migration rows but is no
    // longer authoritative; `recordValue` is.
    verification: {
      method: { type: String, enum: ["txt"], default: "txt" },
      tokenHash: { type: String, default: null },
      recordName: { type: String, default: null }, // e.g. _matjar-verification.store.com
      recordValue: { type: String, default: null }, // plaintext — DNS TXT value, public
      checkedAt: { type: Date, default: null },
      verifiedAt: { type: Date, default: null },
      failureReason: { type: String, default: null },
    },

    // DNS target health. Independent of ownership — a merchant can
    // prove ownership long before they point traffic at us.
    dns: {
      targetType: {
        type: String,
        enum: ["CNAME", "A", "ALIAS", null],
        default: null,
      },
      expectedTarget: { type: String, default: null },
      lastResolved: { type: String, default: null },
      lastCheckedAt: { type: Date, default: null },
      error: { type: String, default: null },
    },

    // SSL certificate state. Decoupled from DNS so a cert can be in
    // `renewing` while the domain is still `active` serving traffic.
    ssl: {
      provider: {
        type: String,
        enum: ["cloudflare", "lets_encrypt", "vercel", "route53", "custom", null],
        default: null,
      },
      status: {
        type: String,
        enum: ["pending", "issued", "failed", "renewing", null],
        default: null,
      },
      // Provider-specific reference id for the issued cert / custom
      // hostname. Cloudflare for SaaS returns a custom_hostname id
      // that's needed for status polling, renewals, and deletion.
      // Opaque to us — each adapter owns the format.
      providerRef: { type: String, default: null },
      issuedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
      error: { type: String, default: null },
    },

    // HTTPS and canonical-host behavior. `canonicalHost` is the
    // hostname this domain should redirect *to* — e.g. `store.com`
    // rows set canonicalHost=`www.store.com` to 301 apex→www.
    redirects: {
      forceHttps: { type: Boolean, default: true },
      canonicalHost: { type: String, default: null },
    },

    // Audit: who added it (tenant user id). Domain add/remove/verify
    // events are also written to the AuditLog collection by the service.
    createdBy: { type: Schema.Types.ObjectId, default: null },

    disabledAt: { type: Date, default: null },
    disabledReason: { type: String, default: null },
  },
  { timestamps: true }
);

// Globally unique hostname — prevents two tenants from claiming the
// same host. Case/whitespace already normalized at write time by the
// hostnameNormalize util, so a plain unique index is sufficient.
domainSchema.index({ hostname: 1 }, { unique: true });
domainSchema.index({ tenantId: 1, isPrimary: 1 });
domainSchema.index({ tenantId: 1, kind: 1 });

domainSchema.methods.isServing = function () {
  return this.status === DOMAIN_STATUSES.ACTIVE;
};

domainSchema.methods.toPublicJSON = function () {
  // Strip the legacy tokenHash (internal, unused by the dashboard)
  // before serializing. `recordValue` is intentionally retained —
  // once a domain is verified the dashboard still shows the DNS
  // record for reference, and the value is public DNS data anyway.
  const obj = this.toObject();
  if (obj.verification) {
    delete obj.verification.tokenHash;
  }
  return obj;
};

export default domainSchema;
