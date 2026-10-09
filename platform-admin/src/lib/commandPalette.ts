import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NAV_GROUPS, TENANT_TABS, canSee, canSeeTab, tabHref } from '../components/nav';
import type { PlatformUser, TenantListRow } from './api';

/**
 * Quick navigator (Ctrl/Cmd+K) helpers: the page index (derived from the
 * sidebar nav so it never drifts), text matching, per-browser "Recent"
 * entries and the global shortcut. The UI lives in components/CommandPalette.
 */

export const PALETTE_STORE_LIMIT = 8;
export const PALETTE_DEBOUNCE_MS = 250;
export const PALETTE_MIN_STORE_QUERY = 2;
/** Mirrors the server-side cap in controllers/platformAdmin.js listTenants. */
export const PALETTE_MAX_QUERY = 100;
const RECENT_LIMIT = 6;
const RECENT_KEY_PREFIX = 'platform_admin_palette_recent';

export interface PageEntry {
  /** Stable key (also the link). */
  to: string;
  label: string;
  /** Breadcrumb context, e.g. "Payments & Billing" or "Billing". */
  context: string | null;
  icon: LucideIcon;
  /** Lower-cased text the query is matched against. */
  haystack: string;
}

/**
 * Every page and in-page tab the operator may open, in sidebar order. Uses
 * the same `canSee` / `canSeeTab` checks as the sidebar and the pages
 * themselves, so staff only see destinations they can actually load.
 */
export function buildPageIndex(user: PlatformUser | null): PageEntry[] {
  const out: PageEntry[] = [];
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (!item.ready || !canSee(user, item)) continue;
      const context = g.label;
      out.push({
        to: item.to,
        label: item.label,
        context,
        icon: item.icon,
        haystack: [item.label, item.shortLabel, context, item.keywords].filter(Boolean).join(' ').toLowerCase(),
      });
      for (const tab of item.tabs ?? []) {
        if (tab.isDefault || !canSeeTab(user, tab)) continue;
        out.push({
          to: tabHref(item.to, tab),
          label: tab.label,
          context: item.label,
          icon: item.icon,
          haystack: [tab.label, item.label, item.shortLabel, context].filter(Boolean).join(' ').toLowerCase(),
        });
      }
    }
  }
  return out;
}

/** Tabs of the store currently open (only on /tenants/:id), as page entries. */
export function currentStoreTabs(user: PlatformUser | null, pathname: string, icon: LucideIcon): PageEntry[] {
  const m = /^\/tenants\/([a-f0-9]{24})\/?$/i.exec(pathname);
  if (!m) return [];
  const base = `/tenants/${m[1]}`;
  return TENANT_TABS.filter((t) => canSeeTab(user, t)).map((t) => ({
    to: tabHref(base, t),
    label: t.label,
    context: 'This store',
    icon,
    haystack: `${t.label} this store current store tab`.toLowerCase(),
  }));
}

/**
 * Score a page against the query: every whitespace-separated term must occur
 * in the haystack; label-prefix and word-prefix hits rank higher. 0 = no match.
 */
export function scorePage(entry: PageEntry, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const terms = q.split(/\s+/);
  if (!terms.every((t) => entry.haystack.includes(t))) return 0;
  const label = entry.label.toLowerCase();
  let score = 1;
  if (label === q) score += 100;
  else if (label.startsWith(q)) score += 50;
  else if (label.split(/\s+/).some((w) => w.startsWith(terms[0]))) score += 20;
  else if (label.includes(terms[0])) score += 10;
  if (!entry.context) score += 1; // top-level pages before tabs on ties
  return score;
}

export function filterPages(entries: PageEntry[], query: string): PageEntry[] {
  if (!query.trim()) return entries;
  return entries
    .map((e, i) => ({ e, i, s: scorePage(e, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.e);
}

/** Best display host for a store row (custom domain, else full subdomain, else slug). */
export function storeHost(t: TenantListRow): string {
  // The list returns the raw `domains` sub-document; tolerate both the
  // nested schema shape and the flattened shape declared on TenantListRow.
  const d = t.domains as unknown as
    | {
        subdomain?: string | { name?: string; fullDomain?: string };
        customDomain?: string | { name?: string };
        primaryDomain?: string;
      }
    | undefined;
  const custom = typeof d?.customDomain === 'string' ? d.customDomain : d?.customDomain?.name;
  const sub = typeof d?.subdomain === 'string' ? d.subdomain : d?.subdomain?.fullDomain || d?.subdomain?.name;
  return custom || sub || t.slug;
}

// ── Recent ─────────────────────────────────────────────────────────────

export interface RecentEntry {
  kind: 'page' | 'store';
  to: string;
  label: string;
  context: string | null;
}

/** Per-operator key so a shared browser doesn't show another operator's stores. */
const recentKey = (user: PlatformUser | null) => `${RECENT_KEY_PREFIX}:${user?.id ?? 'anon'}`;

function isRecent(v: unknown): v is RecentEntry {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    (r.kind === 'page' || r.kind === 'store') &&
    typeof r.to === 'string' &&
    // Only in-app absolute paths — never follow a tampered external URL.
    r.to.startsWith('/') &&
    !r.to.startsWith('//') &&
    typeof r.label === 'string' &&
    (r.context === null || typeof r.context === 'string')
  );
}

export function readRecent(user: PlatformUser | null): RecentEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(recentKey(user)) || '[]');
    return Array.isArray(raw) ? raw.filter(isRecent).slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function pushRecent(user: PlatformUser | null, entry: RecentEntry): void {
  try {
    const next = [entry, ...readRecent(user).filter((r) => r.to !== entry.to)].slice(0, RECENT_LIMIT);
    localStorage.setItem(recentKey(user), JSON.stringify(next));
  } catch {
    /* storage unavailable — recents are a convenience */
  }
}

// ── Shortcut ───────────────────────────────────────────────────────────

export const isMacLike = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/** Ctrl/Cmd+K toggles the navigator anywhere; "/" opens it outside text fields. */
export function usePaletteShortcut(toggle: () => void, open: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      } else if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditable(e.target) &&
        // Don't pop over another open dialog.
        !document.querySelector('[role="dialog"][aria-modal="true"]')
      ) {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, open]);
}
