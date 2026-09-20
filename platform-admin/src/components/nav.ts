import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Building2,
  ShoppingCart,
  Package,
  Users2,
  Boxes,
  Receipt,
  CreditCard,
  Globe,
  Palette,
  HeartPulse,
  ToggleLeft,
  Flag,
  Phone,
  Activity,
  MessageSquare,
  ScrollText,
  Layers,
  Server,
  Plug,
  Webhook,
  Bug,
  Users,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { PLATFORM_SCOPES, type PlatformScope, type PlatformUser } from '../lib/api';

/**
 * Platform-admin navigation — mirrors the domain groups of the permanent
 * architecture doc (docs/plans/platform-admin-operating-system.md, archive §2).
 *
 * `scope`: the user must hold it to see the entry (the server enforces; this
 * only hides dead UI). `role`: owner-only pages. `ready: false` entries are
 * planned pages whose routes have not landed yet — they render as disabled
 * hints in the drawer so the structure is visible without dead links.
 *
 * ── SIBLING WORKSTREAMS: add your pages here (flip `ready: true`) AND the
 *    route in App.tsx. Keep the group order. ──────────────────────────────
 */
export interface NavItem {
  to: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  end?: boolean;
  scope?: PlatformScope;
  role?: 'owner';
  /** Show in the phone bottom tab bar. */
  tab?: boolean;
  ready?: boolean;
}
export interface NavGroup {
  key: string;
  label: string | null;
  items: NavItem[];
}

const S = PLATFORM_SCOPES;

export const NAV_GROUPS: NavGroup[] = [
  { key: 'overview', label: null, items: [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true, tab: true, ready: true }] },
  {
    key: 'stores',
    label: 'Stores',
    items: [{ to: '/tenants', label: 'Tenants', icon: Building2, scope: S.SUPPORT_READ, tab: true, ready: true }],
  },
  {
    key: 'commerce',
    label: 'Commerce',
    items: [
      { to: '/commerce/orders', label: 'Orders', icon: ShoppingCart, scope: S.SUPPORT_READ, ready: true },
      { to: '/commerce/products', label: 'Products', icon: Package, scope: S.SUPPORT_READ, ready: true },
      { to: '/commerce/customers', label: 'Customers', icon: Users2, scope: S.SUPPORT_READ, ready: true },
      { to: '/commerce/inventory', label: 'Inventory', icon: Boxes, scope: S.SUPPORT_READ, ready: true },
    ],
  },
  {
    key: 'billing',
    label: 'Payments & Billing',
    items: [
      { to: '/billing', label: 'Billing', icon: Receipt, scope: S.BILLING_READ, tab: true, ready: true },
      { to: '/plans', label: 'Plans', icon: CreditCard, scope: S.BILLING_READ, ready: true },
    ],
  },
  {
    key: 'storefront',
    label: 'Storefront',
    items: [
      { to: '/storefront/domains', label: 'Domains', icon: Globe, scope: S.SUPPORT_READ, ready: true },
      { to: '/storefront/themes', label: 'Themes', icon: Palette, scope: S.SUPPORT_READ, ready: true },
      { to: '/storefront/health', label: 'Storefront health', shortLabel: 'Health', icon: HeartPulse, scope: S.SUPPORT_READ, ready: true },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    items: [
      { to: '/features', label: 'Features', icon: ToggleLeft, scope: S.SUPPORT_READ, ready: true },
      { to: '/programs', label: 'Access programs', shortLabel: 'Programs', icon: Flag, scope: S.SUPPORT_READ, ready: true },
      { to: '/phone-countries', label: 'Phone countries', shortLabel: 'Phones', icon: Phone, scope: S.SUPPORT_READ, ready: true },
    ],
  },
  {
    key: 'support',
    label: 'Support & Ops',
    items: [
      { to: '/activity', label: 'Activity', icon: Activity, scope: S.AUDIT_READ, ready: true },
      { to: '/feedback', label: 'Feedback', icon: MessageSquare, scope: S.SUPPORT_READ, ready: true },
      { to: '/audit', label: 'Audit log', icon: ScrollText, scope: S.AUDIT_READ, ready: true },
      { to: '/queues', label: 'Queues', icon: Layers, scope: S.SUPPORT_READ, ready: true },
    ],
  },
  {
    key: 'system',
    label: 'System',
    items: [
      { to: '/system/health', label: 'Health', icon: Server, scope: S.SUPPORT_READ, ready: true },
      { to: '/system/integrations', label: 'Integrations', icon: Plug, scope: S.SUPPORT_READ, ready: true },
      { to: '/system/webhooks', label: 'Webhooks', icon: Webhook, scope: S.SUPPORT_READ, ready: true },
      { to: '/system/errors', label: 'Errors', icon: Bug, scope: S.SUPPORT_READ, ready: true },
    ],
  },
  {
    key: 'security',
    label: 'Security',
    items: [
      { to: '/users', label: 'Platform users', shortLabel: 'Users', icon: Users, scope: S.PLATFORM_USERS, tab: true, ready: true },
      { to: '/security/me', label: 'My security', icon: ShieldCheck, ready: true },
      { to: '/security/settings', label: 'Security settings', icon: ShieldAlert, role: 'owner', ready: true },
    ],
  },
];

export function canSee(user: PlatformUser | null, item: NavItem): boolean {
  if (item.role && user?.role !== item.role) return false;
  if (item.scope && !user?.scopes?.includes(item.scope)) return false;
  return true;
}

export function visibleGroups(user: PlatformUser | null): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => canSee(user, i)) })).filter((g) => g.items.length > 0);
}

/** Phone bottom bar: the four most-used destinations the user can see. */
export function bottomTabs(user: PlatformUser | null): NavItem[] {
  return NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.tab && i.ready && canSee(user, i)).slice(0, 4);
}
