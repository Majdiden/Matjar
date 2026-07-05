import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { WifiOff, Download, RefreshCw, X, Share, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import {
  getInstallPrompt,
  isAppInstalled,
  clearInstallPrompt,
  subscribeInstall,
} from '../../lib/pwa-install';

const IOS_HINT_DISMISSED_KEY = 'matjar.pwa.iosHintDismissed.v1';
const INSTALL_DISMISSED_KEY = 'matjar.pwa.installDismissed.v1';

const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios/i.test(navigator.userAgent); // only Safari gets the A2HS hint

const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this legacy flag when launched from the home screen.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

/**
 * PWA lifecycle UX, mounted once inside the dashboard shell:
 *  - Offline banner (connectivity is unreliable in Sudan; never blank-screen).
 *  - "New version available — refresh" update prompt (registerType: 'prompt').
 *  - A custom "Install app" affordance driven by `beforeinstallprompt`, plus an
 *    iOS "Add to Home Screen" hint since iOS Safari never fires that event.
 *
 * Renders a stack of slim banners at the top of the content region (in normal
 * flow, so they survive offline navigation and mirror correctly in RTL).
 */
export const PwaManager: React.FC = () => {
  const { t } = useTranslation('common');
  const online = useOnlineStatus();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      // Non-fatal — the app still works online without the SW.
      console.warn('SW registration failed', error);
    },
  });

  // ── Install affordance ────────────────────────────────────────────────
  // Read the install event from the module-level store (populated by the
  // early listener in lib/pwa-install.ts). Seeding state from the store on
  // mount is what fixes the "prompt never appears / needs a refresh" bug —
  // the event usually fires before this component mounts, so a listener
  // attached *here* would miss it.
  const [installEvent, setInstallEvent] = React.useState(() => getInstallPrompt());
  const [appInstalled, setAppInstalled] = React.useState(() => isAppInstalled());
  const [installDismissed, setInstallDismissed] = React.useState(
    () => localStorage.getItem(INSTALL_DISMISSED_KEY) === '1',
  );
  const [iosHintDismissed, setIosHintDismissed] = React.useState(
    () => localStorage.getItem(IOS_HINT_DISMISSED_KEY) === '1',
  );

  React.useEffect(
    () =>
      subscribeInstall(() => {
        setInstallEvent(getInstallPrompt());
        setAppInstalled(isAppInstalled());
      }),
    [],
  );

  const doInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    clearInstallPrompt();
    setInstallEvent(null);
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    setInstallDismissed(true);
  };
  const dismissIosHint = () => {
    localStorage.setItem(IOS_HINT_DISMISSED_KEY, '1');
    setIosHintDismissed(true);
  };

  const showInstall = !!installEvent && !installDismissed && !appInstalled && !isStandalone();
  const showIosHint = isIos() && !isStandalone() && !iosHintDismissed;

  if (!online || needRefresh || showInstall || showIosHint) {
    return (
      <div className="mb-4 space-y-2">
        {/* Offline */}
        {!online && (
          <div className="flex items-center gap-2 rounded-lg border border-warning-soft-foreground/30 bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t('pwa.offline.banner')}</span>
          </div>
        )}

        {/* Update available */}
        {needRefresh && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary-soft px-3 py-2 text-sm text-primary-soft-foreground">
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{t('pwa.update.message')}</span>
            <Button size="sm" className="h-8 shrink-0" onClick={() => updateServiceWorker(true)}>
              {t('pwa.update.refresh')}
            </Button>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-primary-soft-foreground/70 hover:text-primary-soft-foreground"
              onClick={() => setNeedRefresh(false)}
              aria-label={t('action.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Install (Android/desktop) */}
        {showInstall && (
          <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">{t('pwa.install.message')}</span>
            <Button size="sm" className="h-8 shrink-0" onClick={doInstall}>
              {t('pwa.install.cta')}
            </Button>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={dismissInstall}
              aria-label={t('action.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* iOS Add-to-Home-Screen hint */}
        {showIosHint && (
          <div className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
            <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              {t('pwa.ios.hint_prefix')}{' '}
              <Share className="inline h-3.5 w-3.5 -translate-y-px" />{' '}
              {t('pwa.ios.hint_suffix')}
            </span>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={dismissIosHint}
              aria-label={t('action.close')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
};
