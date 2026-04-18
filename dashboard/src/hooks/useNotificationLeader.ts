import { useCallback, useEffect, useRef, useState } from 'react';

const CHANNEL_NAME = 'matjar-notifications';
const LEADER_KEY = 'matjar-notif-leader';
const REFRESH_MS = 5000;
const STALE_MS = 15000;

interface LeaderRecord {
  tabId: string;
  ts: number;
}

function readLeader(): LeaderRecord | null {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as LeaderRecord;
    if (!p || typeof p.tabId !== 'string' || typeof p.ts !== 'number') return null;
    return p;
  } catch {
    return null;
  }
}

function writeLeader(tabId: string) {
  try {
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, ts: Date.now() }));
  } catch {
    /* ignore */
  }
}

function clearLeader(tabId: string) {
  const cur = readLeader();
  if (cur && cur.tabId === tabId) {
    try {
      localStorage.removeItem(LEADER_KEY);
    } catch {
      /* ignore */
    }
  }
}

export interface NotificationLeader {
  isLeader: boolean;
  broadcast: (msg: unknown) => void;
  subscribe: (handler: (msg: unknown) => void) => () => void;
}

export function useNotificationLeader(): NotificationLeader {
  const tabIdRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [isLeader, setIsLeader] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const handlersRef = useRef<Set<(msg: unknown) => void>>(new Set());

  // BroadcastChannel setup
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = ch;
    const onMessage = (e: MessageEvent) => {
      handlersRef.current.forEach((h) => {
        try {
          h(e.data);
        } catch {
          /* ignore */
        }
      });
    };
    ch.addEventListener('message', onMessage);
    return () => {
      ch.removeEventListener('message', onMessage);
      ch.close();
      channelRef.current = null;
    };
  }, []);

  // Leader election logic
  useEffect(() => {
    const tabId = tabIdRef.current;

    const evaluate = () => {
      const cur = readLeader();
      const now = Date.now();
      if (!cur || now - cur.ts > STALE_MS) {
        writeLeader(tabId);
        // Re-read to tolerate race
        const after = readLeader();
        setIsLeader(!!after && after.tabId === tabId);
        return;
      }
      if (cur.tabId === tabId) {
        // Refresh own lease
        writeLeader(tabId);
        setIsLeader(true);
        return;
      }
      setIsLeader(false);
    };

    evaluate();
    const interval = window.setInterval(evaluate, REFRESH_MS);

    const onStorage = (e: StorageEvent) => {
      if (e.key === LEADER_KEY) evaluate();
    };
    window.addEventListener('storage', onStorage);

    const onBeforeUnload = () => {
      clearLeader(tabId);
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('beforeunload', onBeforeUnload);
      clearLeader(tabId);
    };
  }, []);

  const broadcast = useCallback((msg: unknown) => {
    const ch = channelRef.current;
    if (ch) {
      try {
        ch.postMessage(msg);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const subscribe = useCallback((handler: (msg: unknown) => void) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  return { isLeader, broadcast, subscribe };
}
