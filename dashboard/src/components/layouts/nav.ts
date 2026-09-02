/**
 * Sidebar navigation config (audit 4.1 + 4.2).
 *
 * Kept as a typed data module, separate from DashboardLayout, so the nav
 * is reviewable in isolation. Rules (audit 4.1):
 *  - A parent with >= 2 real children is a pure group toggle: it has
 *    children but NO `href` (Payments, Customers, Themes).
 *  - A parent that would only carry a duplicate of its own href is a flat
 *    link, with its real children promoted to siblings (Orders, Products).
 *
 * Permission gates are preserved from the pre-refactor layout; an item is
 * visible when the user holds at least one of its permission keys.
 */
import type React from 'react';
import type { FeatureKey } from '../../lib/features';
import {
  BarChart3,
  Bell,
  Building2,
  CornerDownRight,
  CreditCard,
  Crown,
  FileCode,
  FileText,
  FolderTree,
  Gift,
  Globe,
  Heart,
  Image,
  Key,
  LayoutDashboard,
  Layers,
  ListTree,
  MessageSquare,
  Package,
  Palette,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Webhook,
} from 'lucide-react';

export interface NavItem {
  name: string;
  /**
   * Destination. Omitted on pure group toggles (parents with children) —
   * per audit 4.1 a parent with real children is not itself a link.
   */
  href?: string;
  icon: React.ElementType;
  /**
   * Dynamic badge slot (audit 4.2.4). Resolved at render time by the
   * layout — `pendingOrders` shows the pending-order count from
   * GET /api/orders/stats and hides at 0.
   */
  badgeKey?: 'pendingOrders';
  children?: NavItem[];
  // If set, the user must have at least one of these permission keys
  // for the item to appear in the sidebar. Omit to make public to any
  // authenticated dashboard user.
  permission?: string | string[];
  // If set, the platform feature flag must be enabled for the item to appear.
  // Combined with `permission` (both must pass). Omit to leave ungated.
  feature?: FeatureKey;
}

export interface NavGroup {
  label: string;
  groupKey: string;
  items: NavItem[];
}

// Nav data uses translation keys; labels are resolved in render.
export const buildNavGroups = (t: (key: string) => string): NavGroup[] => [
  {
    label: t('nav:sidebar.home.title'),
    groupKey: 'home',
    items: [
      { name: t('nav:sidebar.home.dashboard'), href: '/dashboard', icon: LayoutDashboard, permission: 'dashboard.read' },
      { name: t('nav:sidebar.home.analytics'), href: '/dashboard/analytics', icon: BarChart3, permission: 'analytics.read' },
      { name: t('nav:sidebar.home.wishlists'), href: '/dashboard/wishlists', icon: Heart, permission: 'analytics.read' },
      { name: t('nav:sidebar.home.notifications'), href: '/dashboard/notifications', icon: Bell },
    ],
  },
  {
    label: t('nav:sidebar.orders.title'),
    groupKey: 'orders',
    items: [
      { name: t('nav:sidebar.orders.all_orders'), href: '/dashboard/orders', icon: ShoppingCart, permission: 'orders.read', badgeKey: 'pendingOrders' },
      { name: t('nav:sidebar.orders.fulfillments'), href: '/dashboard/fulfillments', icon: Truck, permission: ['fulfillments.read', 'fulfillments.write'], feature: 'orders.fulfillment' },
    ],
  },
  {
    label: t('nav:sidebar.payments.title'),
    groupKey: 'payments',
    items: [
      {
        name: t('nav:sidebar.payments.payments'),
        icon: CreditCard,
        permission: 'payments.read',
        children: [
          { name: t('nav:sidebar.payments.transactions'), href: '/dashboard/payments', icon: CreditCard, permission: 'payments.read', feature: 'payments.transactions' },
          { name: t('nav:sidebar.payments.payment_methods'), href: '/dashboard/payments/methods', icon: Wallet, permission: 'settings.write', feature: 'payments.methods' },
        ],
      },
    ],
  },
  {
    label: t('nav:sidebar.catalog.title'),
    groupKey: 'catalog',
    items: [
      { name: t('nav:sidebar.catalog.products'), href: '/dashboard/products', icon: Package, permission: 'products.read' },
      { name: t('nav:sidebar.catalog.categories'), href: '/dashboard/categories', icon: FolderTree, permission: 'products.read' },
      { name: t('nav:sidebar.catalog.collections'), href: '/dashboard/collections', icon: Layers, permission: 'products.read' },
      { name: t('nav:sidebar.catalog.inventory'), href: '/dashboard/inventory', icon: Warehouse, permission: ['inventory.read', 'inventory.write'] },
    ],
  },
  {
    label: t('nav:sidebar.customers.title'),
    groupKey: 'customers',
    items: [
      {
        name: t('nav:sidebar.customers.customers'),
        icon: Users,
        permission: ['customers.read', 'customers.write'],
        children: [
          { name: t('nav:sidebar.customers.all_customers'), href: '/dashboard/customers', icon: Users, permission: ['customers.read', 'customers.write'] },
          { name: t('nav:sidebar.customers.segments'), href: '/dashboard/customers/segments', icon: Users, permission: ['customers.read', 'customers.write'] },
          { name: t('nav:sidebar.customers.companies'), href: '/dashboard/companies', icon: Building2, permission: ['customers.read', 'customers.write'] },
        ],
      },
      { name: t('nav:sidebar.customers.reviews'), href: '/dashboard/reviews', icon: MessageSquare, permission: ['reviews.read', 'reviews.moderate'] },
    ],
  },
  {
    label: t('nav:sidebar.marketing.title'),
    groupKey: 'marketing',
    items: [
      { name: t('nav:sidebar.marketing.discounts'), href: '/dashboard/marketing/discounts', icon: Tag, permission: ['discounts.read', 'discounts.write'] },
      { name: t('nav:sidebar.marketing.gift_cards'), href: '/dashboard/gift-cards', icon: Gift, permission: ['discounts.read', 'discounts.write'] },
    ],
  },
  {
    label: t('nav:sidebar.storefront.title'),
    groupKey: 'storefront',
    items: [
      {
        name: t('nav:sidebar.storefront.themes'),
        icon: Palette,
        permission: ['themes.read', 'themes.write'],
        children: [
          { name: t('nav:sidebar.storefront.theme_library'), href: '/dashboard/themes', icon: Palette, permission: ['themes.read', 'themes.write'] },
          { name: t('nav:sidebar.storefront.visual_editor'), href: '/dashboard/themes/editor', icon: Palette, permission: 'themes.write' },
        ],
      },
      { name: t('nav:sidebar.storefront.navigation'), href: '/dashboard/menus', icon: ListTree, permission: ['themes.read', 'themes.write'] },
      { name: t('nav:sidebar.storefront.pages'), href: '/dashboard/pages', icon: FileText, permission: ['themes.read', 'themes.write'] },
      { name: t('nav:sidebar.storefront.media'), href: '/dashboard/media', icon: Image, permission: 'themes.write' },
      { name: t('nav:sidebar.storefront.redirects'), href: '/dashboard/redirects', icon: CornerDownRight, permission: ['themes.read', 'themes.write'], feature: 'redirects' },
      { name: t('nav:sidebar.storefront.domains'), href: '/dashboard/domains', icon: Globe, permission: ['domains.read', 'domains.write'], feature: 'domains.custom' },
    ],
  },
  {
    label: t('nav:sidebar.settings.title'),
    groupKey: 'settings',
    items: [
      { name: t('nav:sidebar.settings.settings'), href: '/dashboard/settings', icon: Settings, permission: ['settings.read', 'settings.write'] },
      { name: t('nav:sidebar.settings.subscription'), href: '/dashboard/subscription', icon: Crown, permission: 'settings.read', feature: 'billing.subscription' },
      { name: t('nav:sidebar.settings.custom_fields'), href: '/dashboard/custom-fields', icon: FileCode, permission: 'settings.write', feature: 'customFields' },
      { name: t('nav:sidebar.settings.webhooks'), href: '/dashboard/webhooks', icon: Webhook, permission: 'settings.write', feature: 'webhooks' },
    ],
  },
  {
    label: t('nav:sidebar.team_security.title'),
    groupKey: 'team_security',
    items: [
      { name: t('nav:sidebar.team_security.staff'), href: '/dashboard/staff', icon: UserCog, permission: 'team.manage' },
      { name: t('nav:sidebar.team_security.permissions'), href: '/dashboard/permissions', icon: Key, permission: 'team.manage', feature: 'team.advancedRoles' },
      { name: t('nav:sidebar.team_security.audit_logs'), href: '/dashboard/audit-logs', icon: Shield, permission: 'audit.read', feature: 'auditLogs' },
    ],
  },
];

/** Flatten groups to leaf items (parents included only when they link). */
export const flattenNav = (items: NavItem[]): NavItem[] =>
  items.flatMap((i) => (i.children ? [i, ...i.children] : [i]));
