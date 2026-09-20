// Small shared helpers for filterable, paginated list pages (Feedback, Webhooks…).
import type { URLSearchParamsInit } from 'react-router-dom';

export const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Parse `?page=` into a positive integer (defaults to 1). */
export function parsePage(raw: string | null): number {
  const n = parseInt(raw || '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Keep a query value only if it is in the allow-list. */
export function allowed<T extends string>(raw: string | null, list: readonly T[]): T | '' {
  return raw && (list as readonly string[]).includes(raw) ? (raw as T) : '';
}

/**
 * Build a setter that updates one query param and resets `page` unless the
 * param being set IS `page`.
 */
export function makeSetParam(
  searchParams: URLSearchParams,
  setSearchParams: (next: URLSearchParamsInit, opts?: { replace?: boolean }) => void,
) {
  return (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };
}

/**
 * Turn an attachment reference from the API into an absolute href the admin
 * origin can open, plus a short label (host + path) for the link text.
 */
export function attachmentLink(ref: string): { href: string; label: string } {
  if (ref.startsWith('/uploads/')) {
    const base = (import.meta.env.VITE_API_ORIGIN as string | undefined) || window.location.origin;
    return { href: `${base}${ref}`, label: ref };
  }
  try {
    const u = new URL(ref);
    return { href: u.toString(), label: `${u.hostname}${u.pathname}` };
  } catch {
    return { href: '#', label: ref };
  }
}
