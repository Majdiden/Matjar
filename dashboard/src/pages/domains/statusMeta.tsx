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

export interface StatusMeta {
  label: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'progress';
  icon: LucideIcon;
  /** Whether the icon should spin (in-flight states). */
  spin?: boolean;
  description: string;
}

export const STATUS_META: Record<DomainStatus, StatusMeta> = {
  pending_dns: {
    label: 'Pending DNS',
    tone: 'warning',
    icon: Clock,
    description: 'Waiting for the ownership TXT record to appear in DNS.',
  },
  ownership_verified: {
    label: 'Ownership Verified',
    tone: 'info',
    icon: CheckCircle,
    description: 'TXT record confirmed. Checking that DNS routes to the platform edge.',
  },
  dns_verified: {
    label: 'DNS Verified',
    tone: 'info',
    icon: CheckCircle,
    description: 'DNS points at the edge. Ready to request an SSL certificate.',
  },
  provisioning_ssl: {
    label: 'Issuing SSL',
    tone: 'progress',
    icon: Loader2,
    spin: true,
    description: 'SSL certificate issuance in progress. This usually completes in a few minutes.',
  },
  active: {
    label: 'Active',
    tone: 'success',
    icon: ShieldCheck,
    description: 'Serving traffic with a valid SSL certificate.',
  },
  ssl_failed: {
    label: 'SSL Failed',
    tone: 'danger',
    icon: XCircle,
    description: 'Certificate issuance failed. Retry once the underlying issue is fixed.',
  },
  dns_misconfigured: {
    label: 'DNS Misconfigured',
    tone: 'danger',
    icon: AlertCircle,
    description: 'DNS no longer points at the platform edge. Traffic may be failing.',
  },
  disabled: {
    label: 'Disabled',
    tone: 'neutral',
    icon: PowerOff,
    description: 'Domain is disabled and not serving traffic.',
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

export const KIND_LABEL: Record<DomainKind, string> = {
  platform_subdomain: 'Platform Subdomain',
  custom_apex: 'Custom Apex',
  custom_subdomain: 'Custom Subdomain',
};

export const KIND_SHORT: Record<DomainKind, string> = {
  platform_subdomain: 'Subdomain',
  custom_apex: 'Apex',
  custom_subdomain: 'Subdomain',
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
