import { useEffect, useState } from 'react';
import { wishlistApi } from '../api/client';

/**
 * Wishlist hook — the single source of truth for "favourite this product"
 * across every theme (header count, ProductCard heart, QuickView, the
 * /wishlist page).
 *
 * Two modes, one stable API:
 *   • Signed-in customers  → the server wishlist (GET/POST /api/wishlist).
 *   • Guests (no token)    → a localStorage list (`matjar_wishlist`), so the
 *                            heart works before login and nothing is lost.
 *
 * On the first authenticated load we MERGE any guest list into the server
 * (idempotent `add` per id) and clear local storage, so a shopper who hearts
 * items then signs in keeps them.
 *
 * State lives in a module-level store shared by every hook instance: mounting
 * 20 ProductCards fires ONE `GET /wishlist`, and a toggle in any card updates
 * the header badge and every other card instantly. Returned API is stable:
 * `{ items, loading, error, refresh, toggle, includes, count }`.
 */

const LOCAL_KEY = 'matjar_wishlist';

// ─── Helpers ─────────────────────────────────────────────────────

function hasToken(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem('customer_token');
  } catch {
    return false;
  }
}

/** Normalise the many shapes a wishlist entry can take into a product id. */
function idOf(entry: any): string {
  const raw =
    typeof entry === 'string'
      ? entry
      : entry?._id || entry?.product?._id || entry?.productId || entry?.id;
  return String(raw ?? '');
}

function readLocal(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocal(next: any[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
  } catch {
    /* storage full / disabled — ignore, in-memory state still updates */
  }
}

/** Pull the product array out of the backend's (slightly variable) envelope. */
function extractList(res: any): any[] {
  const list =
    res?.data?.wishlist?.products ||
    res?.responseObject?.wishlist?.products ||
    res?.data?.items ||
    res?.data?.products ||
    res?.responseObject?.items ||
    res?.responseObject?.products ||
    [];
  return Array.isArray(list) ? list : [];
}

function isAuthError(err: any): boolean {
  const m = String(err?.message || '').toLowerCase();
  return m.includes('401') || m.includes('unauth') || m.includes('no token');
}

// ─── Module-level shared store ───────────────────────────────────

let items: any[] = [];
let loading = true;
let error: string | null = null;
let initialized = false;
let mergeDone = false;

const subscribers = new Set<() => void>();
function emit() {
  subscribers.forEach((fn) => fn());
}

async function loadServer(): Promise<void> {
  const res: any = await wishlistApi.get();
  items = extractList(res);
}

/**
 * One-time merge of the guest localStorage list into the server wishlist.
 * Idempotent `add` (server uses $addToSet), so re-running is harmless; we
 * guard with a module flag so it only happens on the first authenticated load.
 */
async function maybeMerge(): Promise<void> {
  if (mergeDone) return;
  mergeDone = true;
  const local = readLocal();
  if (local.length === 0) return;
  await Promise.all(
    local
      .map(idOf)
      .filter(Boolean)
      .map((id) => wishlistApi.add(id).catch(() => {}))
  );
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

async function refresh(): Promise<void> {
  loading = true;
  error = null;
  emit();
  try {
    if (hasToken()) {
      await maybeMerge();
      await loadServer();
    } else {
      items = readLocal();
    }
  } catch (err: any) {
    if (isAuthError(err)) {
      // Token expired / rejected — fall back to the guest list.
      items = readLocal();
    } else {
      error = err?.message || 'Failed to load wishlist';
    }
  } finally {
    loading = false;
    emit();
  }
}

function ensureInit(): void {
  if (initialized) return;
  initialized = true;
  refresh();
}

/**
 * Toggle a product in/out of the wishlist. `snapshot` (optional) is a light
 * product object stored for GUESTS so the /wishlist page can render name,
 * image and price without a second fetch. Returns the new membership boolean.
 */
async function toggle(productId: string, snapshot?: any): Promise<boolean> {
  const id = String(productId);
  if (hasToken()) {
    const res: any = await wishlistApi.toggle(id);
    await loadServer();
    emit();
    const inList =
      res?.data?.isInWishlist ??
      res?.responseObject?.isInWishlist ??
      res?.data?.added ??
      res?.responseObject?.added;
    return inList !== undefined ? !!inList : items.some((it) => idOf(it) === id);
  }

  // Guest path — mutate the local list.
  const local = readLocal();
  const exists = local.some((it) => idOf(it) === id);
  const next = exists
    ? local.filter((it) => idOf(it) !== id)
    : [...local, snapshot ? { ...snapshot, _id: id } : { _id: id }];
  writeLocal(next);
  items = next;
  emit();
  return !exists;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useWishlist() {
  const [, force] = useState(0);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    subscribers.add(rerender);
    ensureInit();

    // React to login/logout in this tab or another (customer_token changes),
    // and to guest-list edits made in another tab.
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'customer_token' || e.key === LOCAL_KEY) refresh();
    };
    window.addEventListener('storage', onStorage);

    return () => {
      subscribers.delete(rerender);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const includes = (productId: string) =>
    items.some((it) => idOf(it) === String(productId));

  return {
    items,
    loading,
    error,
    refresh,
    toggle,
    includes,
    count: items.length,
  };
}
