import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';

// =============================================================================
// Green live-store banner: "your store is live at" card with Copy +
// Visit store buttons. Shared between the Domains page and the dashboard
// home (audit 3.7.3). The dashboard passes `manageTo` to add a demoted
// text link to domain settings; the Domains page IS domain settings, so
// it omits the prop.
// =============================================================================

export interface LiveStoreBannerProps {
  /** Hostname the store is live at (no protocol). Renders nothing when empty. */
  hostname: string;
  /** Called with the hostname when the Copy button is pressed. */
  onCopy: (hostname: string) => void;
  /** Optional route for a demoted "Manage" text link (e.g. "/dashboard/domains"). */
  manageTo?: string;
}

/** Storefront URL for a hostname. Local dev hosts have no TLS. */
export const storefrontUrl = (hostname: string) =>
  `${hostname.includes('localhost') ? 'http' : 'https'}://${hostname}`;

// Brand WhatsApp glyph — lucide dropped its brand icons, and WhatsApp is the
// dominant sales channel for Sudanese merchants, so we inline a small mark.
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413Z" />
  </svg>
);

export const LiveStoreBanner: React.FC<LiveStoreBannerProps> = ({
  hostname,
  onCopy,
  manageTo,
}) => {
  const { t } = useTranslation(['domains', 'common']);

  if (!hostname) return null;

  const shareUrl = storefrontUrl(hostname);
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(
    t('common:share.whatsapp_message', { url: shareUrl }),
  )}`;

  return (
    <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/10">
      <CardContent className="py-5 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">
                {t('domains:list.hero.live_at')}
              </p>
              <p
                className="font-mono text-lg sm:text-xl md:text-2xl font-semibold truncate mt-0.5"
                title={hostname}
              >
                {hostname}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            {/* WhatsApp is the primary sharing channel for social commerce. */}
            <Button
              size="sm"
              className="flex-1 sm:flex-none bg-[#25D366] text-white shadow-sm hover:bg-[#20bd5a] active:bg-[#1da851]"
              asChild
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="h-4 w-4 me-1.5" />
                {t('common:share.whatsapp')}
              </a>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => onCopy(hostname)}>
              <Copy className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.hero.copy')}
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => window.open(shareUrl, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.hero.visit')}
            </Button>
            {manageTo && (
              <Button variant="link" size="sm" className="text-muted-foreground w-full sm:w-auto" asChild>
                <Link to={manageTo}>{t('domains:list.hero.manage')}</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
