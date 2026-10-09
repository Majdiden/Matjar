/**
 * Homepage simple editor — loading, saving and undo (PBI 10-13).
 *
 * No draft/publish for the merchant: every change is sent with the existing
 * theme-customization APIs (section settings / toggle / reorder) and then
 * published (`POST /theme-customization/publish`, which also records a
 * version), so it is live on the store as soon as it is saved.
 *
 * Built for weak connections, like useProfileAutosave:
 *   - the last loaded homepage is cached per store, so the screen opens
 *     offline;
 *   - a change is written to localStorage BEFORE it is sent and removed only
 *     once the server has it; changes left over from a previous visit are
 *     applied on top of what loads and sent again;
 *   - changes go out one at a time, in order; network / server failures
 *     retry with backoff and as soon as the browser is back online, then a
 *     single publish follows once nothing is waiting. A rejected change (4xx)
 *     is dropped and the page reloads what the store really has.
 *
 * Undo re-applies what the change replaced (the section's previous settings,
 * visibility or the previous order) through the same queue, and publishes
 * again. See docs/delivery/10/10-13.md for why this was chosen over the
 * version rollback API.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api-client';
import {
  applyOp,
  applyOps,
  inverseOp,
  isShown,
  opFits,
  opKey,
  sortSections,
  type HomeSection,
  type HomepageOp,
} from '../lib/homepageEditor';
import { isRetryableError, readJson, RETRY_DELAYS_S, useStoreKey, writeJson } from './useStoreProfile';
import type { SectionDefinition } from '@matjar/theme-shared/types/theme';
import { isBasicSection } from '@matjar/theme-shared/theme/settingLevels';

const CACHE_PREFIX = 'matjar.homepage.v1:';
const PENDING_PREFIX = 'matjar.homepageEdits.v1:';
/** Most changes the merchant can step back through. */
const MAX_UNDO_STEPS = 20;
const TEMPLATE = { template: 'index' } as const;

export interface HomepageData {
  themeSlug: string;
  /** The full editor has changes that are not on the store yet. */
  isDraft: boolean;
  sections: HomeSection[];
  /** Section definitions of the active theme (from the manifest schema). */
  definitions: SectionDefinition[];
}

interface CachedHomepage extends HomepageData {
  /** Hub card status: listed sections shown / listed. */
  summary?: { shown: number; total: number };
}

interface PendingStore {
  themeSlug: string;
  ops: HomepageOp[];
  publish: boolean;
}

export type HomepageSaveState = 'idle' | 'saving' | 'saved' | 'retrying' | 'error';

/** Sections the simple editor lists: known to the theme and `basic`. */
export function listedSections(data: Pick<HomepageData, 'sections' | 'definitions'>) {
  const defs = new Map(data.definitions.map((d) => [d.type, d]));
  return sortSections(data.sections).filter((s) => {
    const def = defs.get(s.type);
    return s.known !== false && !!def && isBasicSection(def);
  });
}

function summaryOf(data: HomepageData) {
  const listed = listedSections(data);
  return { shown: listed.filter(isShown).length, total: listed.length };
}

/** Last known "N of M parts shown" for the hub card, without a request. */
export function readHomepageSummary(storeKey: string) {
  return readJson<CachedHomepage>(CACHE_PREFIX + storeKey)?.summary ?? null;
}

interface CustomizationEnvelope {
  data?: { customization?: { themeSlug?: string; isDraft?: boolean; sectionsByTemplate?: Record<string, HomeSection[]>; sections?: HomeSection[] } };
}

async function fetchHomepage(): Promise<HomepageData> {
  const res = (await api.themeCustomization.get()) as CustomizationEnvelope;
  const cust = res?.data?.customization;
  if (!cust) throw new Error('no customization');
  const themeSlug = cust.themeSlug || 'modern';
  const schemaRes = (await api.themeCustomization.getManifestSchema(themeSlug)) as {
    data?: { schema?: { sections?: SectionDefinition[] } };
  };
  const list = cust.sectionsByTemplate?.index ?? cust.sections ?? [];
  return {
    themeSlug,
    isDraft: !!cust.isDraft,
    sections: list.map((s) => ({ ...s, settings: { ...(s.settings || {}) } })),
    definitions: schemaRes?.data?.schema?.sections ?? [],
  };
}

function sendOp(op: HomepageOp) {
  switch (op.kind) {
    case 'settings':
      return api.themeCustomization.updateSectionSettings(op.sectionId, op.settings, undefined, TEMPLATE);
    case 'visible':
      return api.themeCustomization.toggleSection(op.sectionId, op.visible, TEMPLATE);
    case 'order':
      return api.themeCustomization.reorderSections(op.sectionIds, TEMPLATE);
  }
}

/**
 * @param onLive  called with every change (and undo) as it is made, to
 *                update the phone preview without waiting for the server.
 */
export function useHomepageEditor(onLive?: (op: HomepageOp, before: HomeSection[]) => void) {
  const storeKey = useStoreKey();
  const cacheKey = CACHE_PREFIX + storeKey;
  const pendingKey = PENDING_PREFIX + storeKey;

  // Waiting changes, newest per key, in the order they were first made.
  const pendingRef = useRef<Map<string, HomepageOp>>(new Map());
  const publishNeededRef = useRef(false);
  const themeRef = useRef<string | null>(null);
  const [data, setDataState] = useState<HomepageData | null>(() => {
    const cached = readJson<CachedHomepage>(cacheKey);
    const pending = readJson<PendingStore>(pendingKey);
    if (pending && Array.isArray(pending.ops)) {
      for (const op of pending.ops) pendingRef.current.set(opKey(op), op);
      publishNeededRef.current = !!pending.publish || pending.ops.length > 0;
      themeRef.current = pending.themeSlug || null;
    }
    if (!cached?.sections) return null;
    return { ...cached, sections: applyOps(cached.sections, [...pendingRef.current.values()]) };
  });
  const dataRef = useRef(data);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveState, setSaveState] = useState<HomepageSaveState>(() =>
    pendingRef.current.size || publishNeededRef.current ? 'retrying' : 'idle',
  );
  const [lastWasUndo, setLastWasUndo] = useState(false);
  // What each change replaced, newest last (in memory only).
  const undoRef = useRef<HomepageOp[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const onLiveRef = useRef(onLive);
  useEffect(() => {
    onLiveRef.current = onLive;
  }, [onLive]);

  const setData = useCallback(
    (next: HomepageData) => {
      dataRef.current = next;
      setDataState(next);
      writeJson(cacheKey, { ...next, summary: summaryOf(next) });
    },
    [cacheKey],
  );

  const persistPending = useCallback(() => {
    const ops = [...pendingRef.current.values()];
    writeJson(
      pendingKey,
      ops.length || publishNeededRef.current
        ? { themeSlug: themeRef.current || dataRef.current?.themeSlug || '', ops, publish: publishNeededRef.current }
        : null,
    );
  }, [pendingKey]);

  // ---- sending -------------------------------------------------------------

  const runningRef = useRef(false);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const reloadRef = useRef<() => Promise<void>>(async () => {});

  const scheduleRetry = useCallback(() => {
    const delay = RETRY_DELAYS_S[Math.min(attemptRef.current, RETRY_DELAYS_S.length - 1)];
    attemptRef.current += 1;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), delay * 1000);
    setSaveState('retrying');
  }, []);

  const flush = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    clearTimeout(timerRef.current);
    let rejected = false;
    try {
      while (pendingRef.current.size || publishNeededRef.current) {
        setSaveState('saving');
        const next = pendingRef.current.entries().next();
        try {
          if (!next.done) {
            const [key, op] = next.value;
            try {
              await sendOp(op);
            } catch (err) {
              if (isRetryableError(err)) throw err;
              rejected = true; // the server refused this change — drop it
            }
            if (pendingRef.current.get(key) === op) pendingRef.current.delete(key);
            publishNeededRef.current = true;
            persistPending();
            continue;
          }
          await api.themeCustomization.publish();
          publishNeededRef.current = false;
          persistPending();
        } catch (err) {
          if (isRetryableError(err)) {
            scheduleRetry();
            return;
          }
          // Publish refused (the saved homepage doesn't pass the checks).
          publishNeededRef.current = false;
          persistPending();
          rejected = true;
        }
      }
      attemptRef.current = 0;
      setSaveState(rejected ? 'error' : 'saved');
      if (rejected) {
        undoRef.current = [];
        setCanUndo(false);
      }
      // Bring the "where does this come from" notes up to date (and, after a
      // refusal, put back what the store really has).
      void reloadRef.current();
    } finally {
      runningRef.current = false;
    }
  }, [persistPending, scheduleRetry]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // ---- loading -------------------------------------------------------------

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const fresh = await fetchHomepage();
      // A change saved for another look (theme switched since) can't apply.
      if (themeRef.current && themeRef.current !== fresh.themeSlug) {
        pendingRef.current.clear();
        publishNeededRef.current = false;
      }
      themeRef.current = fresh.themeSlug;
      for (const [key, op] of pendingRef.current) {
        if (!opFits(op, fresh.sections)) pendingRef.current.delete(key);
      }
      persistPending();
      setData({ ...fresh, sections: applyOps(fresh.sections, [...pendingRef.current.values()]) });
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [persistPending, setData]);
  useEffect(() => {
    reloadRef.current = async () => {
      // Don't overwrite changes that are still on their way.
      if (pendingRef.current.size || publishNeededRef.current || runningRef.current) return;
      await reload();
    };
  }, [reload]);

  useEffect(() => {
    void reload().then(() => {
      if (pendingRef.current.size || publishNeededRef.current) void flushRef.current();
    });
  }, [reload]);

  useEffect(() => {
    const onOnline = () => {
      attemptRef.current = 0;
      void flushRef.current();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      clearTimeout(timerRef.current);
    };
  }, []);

  // ---- changes -------------------------------------------------------------

  const apply = useCallback(
    (op: HomepageOp) => {
      const current = dataRef.current;
      if (!current) return;
      const before = current.sections;
      setData({ ...current, isDraft: false, sections: applyOp(before, op) });
      onLiveRef.current?.(op, before);
      const key = opKey(op);
      // Re-insert so the newest change to a key goes after older other ones.
      pendingRef.current.delete(key);
      pendingRef.current.set(key, op);
      persistPending();
      attemptRef.current = 0;
      void flushRef.current();
    },
    [persistPending, setData],
  );

  /** Make a change (it saves and goes live by itself). */
  const change = useCallback(
    (op: HomepageOp) => {
      const current = dataRef.current;
      if (!current) return;
      const inverse = inverseOp(current.sections, op);
      if (inverse) {
        undoRef.current = [...undoRef.current.slice(-(MAX_UNDO_STEPS - 1)), inverse];
        setCanUndo(true);
      }
      setLastWasUndo(false);
      apply(op);
    },
    [apply],
  );

  /** Put back what the last change replaced. */
  const undo = useCallback(() => {
    const inverse = undoRef.current.pop();
    setCanUndo(undoRef.current.length > 0);
    if (!inverse) return;
    setLastWasUndo(true);
    apply(inverse);
  }, [apply]);

  /** "Try now" — skip the wait before the next automatic retry. */
  const retry = useCallback(() => {
    attemptRef.current = 0;
    void flushRef.current();
  }, []);

  return {
    data,
    loading,
    loadFailed,
    reload,
    change,
    undo,
    canUndo,
    retry,
    saveState,
    lastWasUndo,
  };
}
