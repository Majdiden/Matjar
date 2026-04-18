I would treat domain management as a first-class platform resource, not as a small
settings object under Tenant.

Your current implementation is a decent MVP: tenant subdomain, one custom domain,
TXT verification, primary-domain switch, SSL flag, and hostname-based tenant
resolution exist in schemas/tenant.js:10, services/domain.js:68, and middlewares/
tenantContext.js:14. For enterprise readiness, I would evolve it into this model:

Recommended Model
Create a separate Domain collection instead of embedding only domains.customDomain
in Tenant.

Each domain should have:

{
tenantId,
hostname,
kind: "platform_subdomain" | "custom_apex" | "custom_subdomain",
status: "pending_dns" | "dns_verified" | "provisioning_ssl" | "active" |
"ssl_failed" | "disabled",
isPrimary,
verification: {
method: "txt",
tokenHash,
recordName,
recordValue,
checkedAt,
verifiedAt
},
dns: {
targetType: "CNAME" | "A" | "ALIAS",
expectedTarget,
lastResolved,
lastCheckedAt,
error
},
ssl: {
provider: "cloudflare" | "lets_encrypt" | "vercel" | "custom",
status: "pending" | "issued" | "failed" | "renewing",
issuedAt,
expiresAt,
error
},
redirects: {
forceHttps: true,
canonicalHost
}
}

Keep Tenant.settings focused on store configuration, and keep domains in a domain
registry. Tenant can store only primaryDomainId or cache activeDomain for fast
reads.

Why This Is Better

- Multiple domains become possible: example.com, www.example.com, shop.example.co
  m, regional domains later.
- Domain lifecycle becomes explicit instead of boolean flags like isVerified and
  sslEnabled.
- SSL provisioning can fail, retry, expire, and renew independently of tenant
  settings.
- Routing can resolve by indexed hostname quickly and safely.
- You can support redirects/canonical domains cleanly.
- Enterprise customers often need staging domains, redirects, and multiple brand
  domains.

How Merchant Control Should Work
Merchants should configure domains, but they should not control low-level routing
or SSL internals.

Merchant can:

- Add/remove custom domains.
- See DNS instructions.
- Click “Verify”.
- Choose primary domain.
- Enable/disable redirects like www to apex or apex to www.
- See SSL/DNS status.

Platform controls:

- DNS verification rules.
- Hostname uniqueness.
- Certificate issuance.
- Runtime routing.
- HTTPS enforcement.
- Abuse prevention.
- Reserved hostnames.
- Domain removal cleanup.

Important Changes I’d Make

1. Replace enableSSLService as a fake success flag. Right now it marks SSL enabled
   immediately after verification in services/domain.js:180 and repositories/
   domain.js:68. In production, this should enqueue a certificate job and only
   mark active after the provider confirms issuance.
2. Do not activate custom domains on TXT verification alone. TXT proves ownership,
   but serving traffic also needs DNS target correctness and certificate
   readiness. Current verification marks isVerified in services/domain.js:132.
   Better status flow: pending_dns -> ownership_verified -> dns_target_verified ->
   ssl_ready -> active.
3. Normalize hostnames aggressively. Lowercase, strip trailing dot, punycode IDNs,
   reject IP literals, reject localhost/internal/reserved TLDs for custom domains,
   reject your own platform domain. Current validation is simple regex-only in se
   rvices/domain.js:30.
4. Unify tenant resolution. You currently have domain resolution in both
   middlewares/tenantContext.js:14 and middlewares/storefrontServe.js:97. That
   should become one shared resolveTenantByHost(host) service backed by the domain
   registry.
5. Add canonical redirects. If primary is www.store.com, requests to store.com sh
   ould 301 to it, or vice versa. This improves SEO and avoids duplicate storefro
   nt URLs.
6. Add background checks. A scheduled worker should re-check DNS and SSL status.
   Domains break when merchants change DNS later; the platform should detect that
   and show dns_misconfigured instead of silently failing.
7. Add audit logs. Domain add/remove/verify/primary-change should be audit events.
   Domains are security-sensitive because changing them controls customer-facing
   traffic.

Recommended Lifecycle

1. Merchant adds store.com.
2. Platform creates domain row with pending_dns.
3. Platform returns DNS instructions:

TXT \_matjar-verification.store.com = <token>
CNAME www.store.com = stores.matjar.com
A/ALIAS store.com = platform edge target

4. Merchant clicks verify.
5. Platform checks TXT ownership.
6. Platform checks CNAME/A target.
7. Platform requests certificate.
8. Certificate becomes active.
9. Domain status becomes active.
10. Merchant can set it as primary.
11. Platform redirects non-primary domains to primary.

My Recommendation
DNS provider automation. Build the correct state machine
and data model first. Use manual DNS instructions plus automated verification.
Then plug in Cloudflare/Vercel/Route53 or an edge provider. and redesign the domain management page.
