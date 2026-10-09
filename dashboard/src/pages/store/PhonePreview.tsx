/**
 * Phone-sized live preview of the merchant's storefront (PBI 10-12).
 *
 * The storefront is rendered at a real phone width (390px) and scaled down to
 * fit its box, so the merchant sees what a customer sees on their phone. It
 * loads the owner preview URL from GET /store-setup/starter (the stable store
 * preview token, which also lets the storefront be framed — see
 * middlewares/storefrontServe.js). Bump `reloadKey` after a save to refresh.
 *
 * The theme editor's PreviewFrame is a desktop browser-chrome canvas with
 * device modes; this is the small phone frame the simple screens need.
 *
 * The homepage editor (10-13) also passes `iframeRef` + `onUrl` to send the
 * editor's live-preview messages (SECTION_UPDATE, …) into the frame, and
 * `screenHeight` to show a shorter phone screen (the page scrolls inside).
 */
import { useEffect, useRef, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, WifiOff } from 'lucide-react';
import { api } from '../../lib/api-client';
import { cn } from '../../lib/utils';

const PHONE_WIDTH_PX = 390;
const PHONE_HEIGHT_PX = 780;

let previewUrlPromise: Promise<string | null> | null = null;

/** One owner-preview URL per page load (the token is stable). */
function fetchPreviewUrl(): Promise<string | null> {
  previewUrlPromise ??= api.storeSetup
    .starter()
    .then((res) => res?.responseObject?.previewUrl || null)
    .catch(() => {
      previewUrlPromise = null; // let the next mount try again
      return null;
    });
  return previewUrlPromise;
}

interface PhonePreviewProps {
  reloadKey?: number;
  /** Visible height of the screen area; the page is scaled to the box width. */
  className?: string;
  /** Height of the visible screen in CSS px (default: a whole phone screen). */
  screenHeight?: number;
  iframeRef?: Ref<HTMLIFrameElement>;
  /** Called with the preview URL once it is known (null when unavailable). */
  onUrl?: (url: string | null) => void;
}

export default function PhonePreview({ reloadKey = 0, className, screenHeight, iframeRef, onUrl }: PhonePreviewProps) {
  const { t } = useTranslation('storeDesign');
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.75);

  useEffect(() => {
    let alive = true;
    void fetchPreviewUrl().then((u) => {
      if (!alive) return;
      setUrl(u);
      onUrl?.(u);
    });
    return () => {
      alive = false;
    };
    // Fetched once per mount; `onUrl` is a notification only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setScale(width / PHONE_WIDTH_PX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setLoaded(false), [reloadKey, url]);

  const boxHeight = screenHeight ?? PHONE_HEIGHT_PX * scale;

  return (
    <div className={cn('mx-auto w-full max-w-[320px] rounded-[2rem] border-[6px] border-foreground/85 bg-foreground/85 shadow-xl', className)}>
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-[1.6rem] bg-background"
        style={{ height: boxHeight }}
      >
        {url ? (
          <iframe
            ref={iframeRef}
            key={`${url}-${reloadKey}`}
            src={url}
            title={t('preview.title')}
            onLoad={() => setLoaded(true)}
            className="absolute top-0 border-0 bg-white"
            // Scale from the physical left edge in both directions so the
            // page lines up with the frame under RTL too.
            style={{
              width: PHONE_WIDTH_PX,
              height: boxHeight / scale,
              left: 0,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        ) : null}
        {(url === undefined || (url && !loaded)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            {t('preview.loading')}
          </div>
        )}
        {url === null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <WifiOff className="h-6 w-6" />
            {t('preview.unavailable')}
          </div>
        )}
      </div>
    </div>
  );
}
