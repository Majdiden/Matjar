import {
  Clock,
  CheckCircle,
  Loader2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  PowerOff,
  type LucideIcon,
} from 'lucide-react';
import type { DomainStatus, DomainKind } from './types';

// Single source of truth for how each state-machine status is
// presented. Every component that renders a status reads from here
// — no ad-hoc if/else ladders for colors or labels.
//
// NOTE: labelKey and descriptionKey are i18n key paths under the
// `domains` namespace. Use t(meta.labelKey) / t(meta.descriptionKey)
// to render localised text.

export interface StatusMeta {
  /** i18n key under the `domains` namespace — use t(labelKey) */
  labelKey: string;
  /** i18n key under the `domains` namespace — use t(descriptionKey) */
  descriptionKey: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress';
  icon: LucideIcon;
  /** Whether the icon should spin (in-flight states). */
  spin?: boolean;
}

export const STATUS_META: Record<DomainStatus, StatusMeta> = {
  pending_dns: {
    labelKey: 'domains:ssl.status.pending_dns',
    descriptionKey: 'domains:ssl.description.pending_dns',
    tone: 'warning',
    icon: Clock,
  },
  ownership_verified: {
    labelKey: 'domains:ssl.status.ownership_verified',
    descriptionKey: 'domains:ssl.description.ownership_verified',
    tone: 'info',
    icon: CheckCircle,
  },
  dns_verified: {
    labelKey: 'domains:ssl.status.dns_verified',
    descriptionKey: 'domains:ssl.description.dns_verified',
    tone: 'info',
    icon: CheckCircle,
  },
  provisioning_ssl: {
    labelKey: 'domains:ssl.status.provisioning_ssl',
    descriptionKey: 'domains:ssl.description.provisioning_ssl',
    tone: 'progress',
    icon: Loader2,
    spin: true,
  },
  active: {
    labelKey: 'domains:ssl.status.active',
    descriptionKey: 'domains:ssl.description.active',
    tone: 'success',
    icon: ShieldCheck,
  },
  ssl_failed: {
    labelKey: 'domains:ssl.status.ssl_failed',
    descriptionKey: 'domains:ssl.description.ssl_failed',
    tone: 'danger',
    icon: XCircle,
  },
  dns_misconfigured: {
    labelKey: 'domains:ssl.status.dns_misconfigured',
    descriptionKey: 'domains:ssl.description.dns_misconfigured',
    tone: 'danger',
    icon: AlertCircle,
  },
  disabled: {
    labelKey: 'domains:ssl.status.disabled',
    descriptionKey: 'domains:ssl.description.disabled',
    tone: 'neutral',
    icon: PowerOff,
  },
};

export const TONE_CLASSES: Record<StatusMeta['tone'], string> = {
  neutral:  'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:border-gray-800',
  info:     'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900',
  success:  'bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900',
  warning:  'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:border-yellow-900',
  danger:   'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900',
  progress: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900',
};

export const KIND_LABEL_KEY: Record<DomainKind, string> = {
  platform_subdomain: 'domains:add.kind.subdomain',
  custom_apex: 'domains:add.kind.apex',
  custom_subdomain: 'domains:add.kind.subdomain',
};

export const KIND_SHORT_KEY: Record<DomainKind, string> = {
  platform_subdomain: 'domains:add.kind.subdomain',
  custom_apex: 'domains:add.kind.apex',
  custom_subdomain: 'domains:add.kind.subdomain',
};

/** The progression of states a healthy custom domain moves through.
 * Used to render the state machine timeline in the detail sheet. */
export const HEALTHY_PROGRESSION: DomainStatus[] = [
  'pending_dns',
  'ownership_verified',
  'dns_verified',
  'provisioning_ssl',
  'active',
];
