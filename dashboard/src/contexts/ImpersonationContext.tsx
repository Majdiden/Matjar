import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { api } from '../lib/api-client';
import { IMPERSONATION_EVENT } from '../hooks/useNotifications';

export interface PendingGrant {
  grantId: string;
  ticket: string;
  supportName?: string;
  supportEmail?: string;
  code?: string;
  approvalExpiresAt?: string;
}

export interface ActiveGrant {
  grantId: string;
  ticket: string;
  supportName?: string;
  supportEmail?: string;
  sessionExpiresAt?: string;
  storeName?: string | null;
}

interface ImpersonationState {
  viewerRole: 'owner' | 'support';
  pending: PendingGrant[];
  active: ActiveGrant | null;
  refresh: () => void;
  /** True once the initial /state fetch has resolved (avoids overlay flicker). */
  ready: boolean;
}

const ImpersonationCtx = createContext<ImpersonationState | null>(null);

// Slow safety-net poll — the SSE bridge (IMPERSONATION_EVENT) drives instant
// updates; this only catches a missed event or a reload during a live session.
const POLL_INTERVAL_MS = 25_000;

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [viewerRole, setViewerRole] = useState<'owner' | 'support'>('owner');
  const [pending, setPending] = useState<PendingGrant[]>([]);
  const [active, setActive] = useState<ActiveGrant | null>(null);
  const [ready, setReady] = useState(false);
  const inFlight = useRef(false);

  const fetchState = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await api.impersonation.state();
      const data = (res as { data?: {
        viewerRole: 'owner' | 'support';
        pending: PendingGrant[];
        active: ActiveGrant | null;
      } }).data;
      if (data) {
        setViewerRole(data.viewerRole);
        setPending(Array.isArray(data.pending) ? data.pending : []);
        setActive(data.active ?? null);
      }
    } catch {
      /* Non-fatal — a transient error just leaves the last known state. */
    } finally {
      inFlight.current = false;
      setReady(true);
    }
  }, []);

  // Initial fetch (keeps the freeze/banner across reloads).
  useEffect(() => {
    void fetchState();
  }, [fetchState]);

  // React instantly to SSE-bridged lifecycle events.
  useEffect(() => {
    const onEvent = () => {
      void fetchState();
    };
    window.addEventListener(IMPERSONATION_EVENT, onEvent as EventListener);
    return () => window.removeEventListener(IMPERSONATION_EVENT, onEvent as EventListener);
  }, [fetchState]);

  // Safety-net poll.
  useEffect(() => {
    const id = window.setInterval(() => void fetchState(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchState]);

  return (
    <ImpersonationCtx.Provider
      value={{ viewerRole, pending, active, refresh: fetchState, ready }}
    >
      {children}
    </ImpersonationCtx.Provider>
  );
};

export function useImpersonation(): ImpersonationState {
  const ctx = useContext(ImpersonationCtx);
  if (!ctx) {
    throw new Error('useImpersonation must be used within ImpersonationProvider');
  }
  return ctx;
}
