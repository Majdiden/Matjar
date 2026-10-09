/**
 * Store profile loading + per-field autosave for the "My store" screens
 * (PBI 10-12).
 *
 * Built for weak, intermittent connections (Sudan):
 *   - the last loaded profile is cached per store in localStorage, so the
 *     hub and the form open offline;
 *   - every field saves on its own (`save(field, patch)`); an edit is written
 *     to localStorage BEFORE it is sent and removed only once the server has
 *     it, so a dropped connection or a closed tab never loses typed text;
 *   - network / server failures retry with backoff and again as soon as the
 *     browser reports it is back online; a rejected value (400) is not
 *     retried until the merchant changes it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api-client';
import { useAuth } from '../contexts/auth-context';
import { toStoreProfile, type StoreProfile, type StoreProfilePatch } from '../lib/storeProfile';

const PROFILE_CACHE_PREFIX = 'matjar.storeProfile.v1:';
const DRAFTS_PREFIX = 'matjar.storeProfileDrafts.v1:';
/** Seconds between automatic retries; the last one repeats. */
export const RETRY_DELAYS_S = [3, 6, 12, 24, 30];
/** How long Save waits for in-flight edits, and how often it checks. */
const FLUSH_TIMEOUT_MS = 15000;
const FLUSH_POLL_MS = 150;

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — the in-memory copy still retries */
  }
}

/** Per-store key for the phone-side caches (one dashboard may run several stores). */
export const useStoreKey = () => useAuth().user?.tenantId || 'current';

/**
 * GET /api/store-profile, rendered instantly from the per-store cache.
 * `profile` is null only on a cold load with nothing cached yet.
 */
export function useStoreProfile() {
  const storeKey = useStoreKey();
  const cacheKey = PROFILE_CACHE_PREFIX + storeKey;
  const [profile, setProfileState] = useState<StoreProfile | null>(() => {
    const cached = readJson<StoreProfile>(cacheKey);
    return cached ? toStoreProfile(cached) : null;
  });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const setProfile = useCallback(
    (update: StoreProfile | ((prev: StoreProfile) => StoreProfile)) => {
      setProfileState((prev) => {
        const next = typeof update === 'function' ? update(prev ?? toStoreProfile(null)) : update;
        writeJson(cacheKey, next);
        return next;
      });
    },
    [cacheKey],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.storeProfile.get();
      setProfile(toStoreProfile(res?.data));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { profile, setProfile, loading, loadFailed, reload };
}

export type FieldSaveState = 'saving' | 'saved' | 'retrying' | 'error';

export interface FieldSaveStatus {
  state: FieldSaveState;
  /** Thrown error for `error` (the page turns it into friendly copy). */
  error?: unknown;
}

interface PendingSave {
  patch: StoreProfilePatch;
  /** What the field showed when it was saved — restored after a reload. */
  draft: unknown;
}

/** Network failures, timeouts, 5xx and 429 are worth retrying; 4xx are not. */
export function isRetryableError(err: unknown): boolean {
  if (typeof err === 'string') return true; // no response envelope (offline, timeout, proxy page)
  const status = (err as { status?: number } | null)?.status;
  return status === undefined || status >= 500 || status === 429;
}

/**
 * Per-field autosave. `save(field, patch, draft)` sends `patch` and tracks
 * its status under `field`; `drafts` holds unsaved field values restored
 * from a previous visit (read them once, when the form mounts).
 */
export function useProfileAutosave(onSaved: (profile: StoreProfile) => void) {
  const storeKey = useStoreKey();
  const draftsKey = DRAFTS_PREFIX + storeKey;

  const pendingRef = useRef<Map<string, PendingSave>>(new Map());
  const inflightRef = useRef<Set<string>>(new Set());
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const [statuses, setStatuses] = useState<Record<string, FieldSaveStatus>>({});
  const [drafts] = useState<Record<string, unknown>>(() => {
    const stored = readJson<Record<string, PendingSave>>(draftsKey) || {};
    for (const [field, entry] of Object.entries(stored)) {
      if (entry && typeof entry === 'object' && entry.patch) pendingRef.current.set(field, entry);
    }
    return Object.fromEntries(Object.entries(stored).map(([f, e]) => [f, e?.draft]));
  });

  const persist = useCallback(() => {
    const map = pendingRef.current;
    writeJson(draftsKey, map.size ? Object.fromEntries(map) : null);
  }, [draftsKey]);

  const setStatus = (field: string, status: FieldSaveStatus) =>
    setStatuses((prev) => ({ ...prev, [field]: status }));

  const send = useCallback(
    async (field: string) => {
      const entry = pendingRef.current.get(field);
      if (!entry || inflightRef.current.has(field)) return;
      inflightRef.current.add(field);
      clearTimeout(timersRef.current.get(field));
      setStatus(field, { state: 'saving' });
      try {
        const res = await api.storeProfile.update(entry.patch);
        if (pendingRef.current.get(field) === entry) {
          pendingRef.current.delete(field);
          persist();
        }
        attemptsRef.current.delete(field);
        setStatus(field, { state: 'saved' });
        if (res?.data) onSavedRef.current(toStoreProfile(res.data));
      } catch (err) {
        if (isRetryableError(err)) {
          const attempt = attemptsRef.current.get(field) ?? 0;
          attemptsRef.current.set(field, attempt + 1);
          const delay = RETRY_DELAYS_S[Math.min(attempt, RETRY_DELAYS_S.length - 1)];
          timersRef.current.set(field, setTimeout(() => void send(field), delay * 1000));
          setStatus(field, { state: 'retrying' });
        } else {
          setStatus(field, { state: 'error', error: err });
        }
      } finally {
        inflightRef.current.delete(field);
      }
      // A newer edit arrived while this one was in flight — send it now.
      const latest = pendingRef.current.get(field);
      if (latest && latest !== entry) void send(field);
    },
    [persist],
  );

  const save = useCallback(
    (field: string, patch: StoreProfilePatch, draft?: unknown) => {
      pendingRef.current.set(field, { patch, draft });
      persist();
      attemptsRef.current.delete(field);
      void send(field);
    },
    [persist, send],
  );

  /** Forget an unsaved edit (e.g. the merchant put the old value back). */
  const discard = useCallback(
    (field: string) => {
      if (!pendingRef.current.delete(field)) return;
      clearTimeout(timersRef.current.get(field));
      persist();
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    [persist],
  );

  // Resend edits left over from a previous visit, and everything waiting as
  // soon as the connection comes back.
  useEffect(() => {
    const timers = timersRef.current;
    const resendAll = () => {
      for (const field of pendingRef.current.keys()) void send(field);
    };
    resendAll();
    window.addEventListener('online', resendAll);
    return () => {
      window.removeEventListener('online', resendAll);
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [send]);

  /** "Try now" — skip the backoff wait for a field that is retrying. */
  const retry = useCallback((field: string) => void send(field), [send]);

  /**
   * The page's Save button: send everything still waiting now (skipping any
   * retry wait) and resolve once nothing is in flight. True when every edit
   * reached the server; false when some are still waiting (offline) or were
   * refused.
   */
  const flush = useCallback(async (): Promise<boolean> => {
    for (const field of pendingRef.current.keys()) {
      attemptsRef.current.delete(field);
      clearTimeout(timersRef.current.get(field));
      void send(field);
    }
    const deadline = Date.now() + FLUSH_TIMEOUT_MS;
    while (inflightRef.current.size && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, FLUSH_POLL_MS));
    }
    return pendingRef.current.size === 0;
  }, [send]);

  return { save, retry, discard, flush, statuses, drafts };
}
