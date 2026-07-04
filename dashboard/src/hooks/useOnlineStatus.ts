import { useEffect, useState } from 'react';

/**
 * Reactive online/offline flag. Sudan's connectivity is slow and unreliable
 * with periodic internet shutdowns, so the whole dashboard is built to
 * degrade gracefully — this hook drives the offline banner and lets pages
 * lean on service-worker-cached data instead of blank-screening.
 *
 * `navigator.onLine` only tells us the device has *a* network interface, not
 * that the internet is reachable, so we treat it as a best-effort signal.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
