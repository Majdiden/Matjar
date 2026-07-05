// Early capture of the PWA install prompt.
//
// Chrome/Edge fire `beforeinstallprompt` very early in page load — often
// BEFORE React has mounted and PwaManager has attached its listener. When
// that happens the event is lost, so the "Install app" affordance never
// appears (or only appears after a refresh, inconsistently). This module
// attaches the listeners at IMPORT time — it's imported at the very top of
// main.tsx, before `createRoot` — so the event is captured no matter how
// early it fires. PwaManager then reads the captured event and subscribes
// for any later firing.

// Minimal typing for the (non-standard) install prompt event.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      /* a broken subscriber must not block the others */
    }
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Suppress the browser's default mini-infobar — we surface our own
    // in-app affordance (PwaManager) instead.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    emit();
  });
}

/** The most recent captured install prompt, or null if none is pending. */
export const getInstallPrompt = (): BeforeInstallPromptEvent | null => deferredPrompt;

/** True once the app has been installed this session. */
export const isAppInstalled = (): boolean => installed;

/** Drop the captured prompt after it's been used (it's single-use). */
export const clearInstallPrompt = (): void => {
  deferredPrompt = null;
  emit();
};

/** Subscribe to capture/consume/install changes. Returns an unsubscribe fn. */
export const subscribeInstall = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
