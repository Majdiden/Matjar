import { createContext, useContext } from 'react';
import type { FirstSaleProgress } from '../lib/onboarding';

/**
 * Guided setup (PBI 10-28): where a new store is in its essentials (first
 * product → logo, cover and tagline → delivery and returns → share), shared by the dashboard home, the
 * checklist card and the guide bar shown on every page until they're done.
 */
export interface SetupGuideContextType {
  /** The store is in guided setup: the flag is on, the user can act, and something is left. */
  active: boolean;
  /** Progress once the signals have loaded; null before. */
  progress: FirstSaleProgress | null;
  /** Public store link for the share step ('' until known). */
  storeUrl: string;
  /** Re-read the signals now (after a change that may finish a step). */
  refresh: () => void;
  /** The merchant shared the store link. */
  recordShared: () => void;
}

export const SetupGuideContext = createContext<SetupGuideContextType | undefined>(undefined);

const INACTIVE: SetupGuideContextType = {
  active: false,
  progress: null,
  storeUrl: '',
  refresh: () => {},
  recordShared: () => {},
};

/** Outside the dashboard layout (e.g. signup) the guide is simply off. */
export function useSetupGuide(): SetupGuideContextType {
  return useContext(SetupGuideContext) ?? INACTIVE;
}

/** Event any screen can fire after a change that may complete a step. */
export const SETUP_CHANGED_EVENT = 'matjar:setup-changed';

export function notifySetupChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETUP_CHANGED_EVENT));
}
