/**
 * PreviewFrame — center canvas for the visual theme editor.
 * Wraps the live preview iframe in a browser-chrome frame and
 * scales width responsively to the active device mode.
 */
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2 } from 'lucide-react';
import type { DeviceMode } from './EditorTopBar';

interface PreviewFrameProps {
  url: string | null;
  deviceMode: DeviceMode;
  reloadKey?: number;
  /**
   * Parent-provided ref so the editor can `postMessage` into the preview
   * iframe for soft refreshes (no remount, no flicker).
   */
  iframeRef?: MutableRefObject<HTMLIFrameElement | null>;
}

const DEVICE_WIDTH: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '820px',
  mobile: '390px',
};

const DEVICE_HEIGHT: Record<DeviceMode, string> = {
  desktop: '100%',
  tablet: '1180px',
  mobile: '844px',
};

export default function PreviewFrame({ url, deviceMode, reloadKey = 0, iframeRef }: PreviewFrameProps) {
  const { t } = useTranslation('themes');
  const frameStyle = useMemo(
    () => ({
      width: DEVICE_WIDTH[deviceMode],
      maxWidth: '100%',
      height: deviceMode === 'desktop' ? '100%' : DEVICE_HEIGHT[deviceMode],
      maxHeight: '100%',
    }),
    [deviceMode]
  );

  // Fade overlay for hard reloads (publish/rollback/page-change). We mount a
  // translucent layer the instant `reloadKey` bumps, then drop it once the
  // iframe's load event fires. Soft refreshes (postMessage-driven) don't
  // change `reloadKey`, so they skip the fade entirely.
  const [fading, setFading] = useState(false);
  const firstRenderRef = useRef(true);
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    setFading(true);
  }, [reloadKey, url]);

  return (
    <div className="flex-1 bg-slate-100 overflow-auto p-6 flex items-start justify-center">
      <div
        className="bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden flex flex-col transition-all duration-300"
        style={frameStyle}
      >
        {/* Browser chrome */}
        <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-3 gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="flex-1 mx-3">
            <div className="h-5 bg-white rounded border border-slate-200 px-2 flex items-center text-[11px] text-slate-500 truncate">
              {url ? new URL(url, window.location.origin).pathname : 'Preview'}
            </div>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 bg-white relative overflow-hidden">
          {url ? (
            <>
              <iframe
                ref={(el) => {
                  if (iframeRef) iframeRef.current = el;
                }}
                key={`${url}-${reloadKey}`}
                src={url}
                title={t('themes.editor.topbar.preview_iframe')}
                className="w-full h-full border-0 block"
                style={{ minHeight: deviceMode === 'desktop' ? 800 : undefined }}
                onLoad={() => setFading(false)}
              />
              <div
                aria-hidden
                className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
                  fading ? 'opacity-60' : 'opacity-0'
                }`}
              />
            </>
          ) : (
            <PreviewSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
      <Eye className="h-10 w-10" />
      <div className="flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Generating preview…
      </div>
    </div>
  );
}
