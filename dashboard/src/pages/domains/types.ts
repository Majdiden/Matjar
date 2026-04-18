// Shared types for the Domain Management page.
// Mirrors schemas/domain.js on the backend. Kept local to this
// page (not hoisted to dashboard/src/types/index.ts) because the
// legacy DomainInfo type in that file is still used by the old
// resolver and tests — we don't want to collide until the backend
// removes its embedded-fields read path.

export const DOMAIN_STATUS = [
  'pending_dns',
  'ownership_verified',
  'dns_verified',
  'provisioning_ssl',
  'active',
  'ssl_failed',
  'dns_misconfigured',
  'disabled',
] as const;

export type DomainStatus = (typeof DOMAIN_STATUS)[number];

export const DOMAIN_KIND = [
  'platform_subdomain',
  'custom_apex',
  'custom_subdomain',
] as const;

export type DomainKind = (typeof DOMAIN_KIND)[number];

export interface DomainRegistryRow {
  _id: string;
  tenantId: string;
  hostname: string;
  kind: DomainKind;
  status: DomainStatus;
  isPrimary: boolean;
  verification?: {
    method?: string;
    recordName?: string | null;
    recordValue?: string | null;
    verifiedAt?: string | null;
    checkedAt?: string | null;
    failureReason?: string | null;
  };
  dns?: {
    targetType?: 'CNAME' | 'A' | 'ALIAS' | null;
    expectedTarget?: string | null;
    lastResolved?: string | null;
    lastCheckedAt?: string | null;
    error?: string | null;
  };
  ssl?: {
    provider?: string | null;
    status?: 'pending' | 'issued' | 'failed' | 'renewing' | null;
    providerRef?: string | null;
    issuedAt?: string | null;
    expiresAt?: string | null;
    lastAttemptAt?: string | null;
    error?: string | null;
  };
  redirects?: {
    forceHttps?: boolean;
    canonicalHost?: string | null;
  };
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DomainInfoResponse {
  subdomain: { name: string; fullDomain: string; isActive: boolean };
  customDomain: {
    name: string;
    isVerified: boolean;
    sslEnabled: boolean;
    verifiedAt?: string;
    sslIssuedAt?: string;
  } | null;
  primaryDomain: 'subdomain' | 'custom';
  activeDomain: string;
  canUseCustomDomain: boolean;
  subscriptionPlan: string;
  registry?: DomainRegistryRow[];
}

// --- Helpers ---------------------------------------------------------------

/** True when a row is still moving through the state machine and the
 * page should keep polling for updates. */
export function isTransitional(status: DomainStatus): boolean {
  return (
    status === 'pending_dns' ||
    status === 'ownership_verified' ||
    status === 'dns_verified' ||
    status === 'provisioning_ssl'
  );
}

/** True when a row is in a terminal failure state the merchant can retry from. */
export function isRetryable(status: DomainStatus): boolean {
  return status === 'ssl_failed' || status === 'dns_misconfigured';
}

/** Days remaining until cert expiry, clamped at 0. Returns null if
 * the row has no expiry (platform subdomains, unissued certs). */
export function daysUntilExpiry(expiresAt?: string | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
