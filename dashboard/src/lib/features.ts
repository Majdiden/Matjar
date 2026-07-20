// Mirrors backend config/featureFlags.js — keep in sync (same convention as
// PLATFORM_SCOPES in platform-admin/src/lib/api.ts mirroring the backend).
//
// The backend serves the EFFECTIVE flags (defaults merged with operator
// overrides) at GET /api/features → { success, data: { flags } }. The
// dashboard only carries the key list + restrictive defaults so an offline
// reload (Sudan connectivity) fails CLOSED — gated surfaces stay hidden until
// the real flags load, never flashing then vanishing.
//
// `themes.allowedSlugs` is intentionally NOT in this type — the dashboard
// never reads it; theme-catalog filtering is enforced server-side.
export type FeatureKey =
  | 'payments.methods' | 'payments.transactions'
  | 'orders.fulfillment' | 'orders.returns' | 'orders.timeline' | 'orders.notes' | 'orders.lifecycle'
  | 'themes.catalogAll'
  | 'webhooks' | 'customFields' | 'team.advancedRoles' | 'auditLogs'
  | 'settings.regional' | 'settings.tax' | 'settings.currencies' | 'settings.markets'
  | 'domains.custom' | 'redirects' | 'billing.subscription';

export type FeatureFlags = Record<string, boolean | string[]>;

// Restrictive soft-launch posture: every boolean flag defaults OFF.
export const DEFAULT_FEATURES: FeatureFlags = {
  'payments.methods': false,
  'payments.transactions': false,
  'orders.fulfillment': false,
  'orders.returns': false,
  'orders.timeline': false,
  'orders.notes': false,
  'orders.lifecycle': false,
  'themes.catalogAll': false,
  webhooks: false,
  customFields: false,
  'team.advancedRoles': false,
  auditLogs: false,
  'settings.regional': false,
  'settings.tax': false,
  'settings.currencies': false,
  'settings.markets': false,
  'domains.custom': false,
  redirects: false,
  'billing.subscription': false,
};

export function isEnabled(flags: FeatureFlags, key: FeatureKey): boolean {
  return flags[key] === true;
}
