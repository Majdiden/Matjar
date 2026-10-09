import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { ShareButton } from './ShareButton';

// =============================================================================
// Green live-store banner: "your store is live at" card with Share, Copy and
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

export const LiveStoreBanner: React.FC<LiveStoreBannerProps> = ({
  hostname,
  onCopy,
  manageTo,
}) => {
  const { t } = useTranslation(['domains', 'common']);

  if (!hostname) return null;

  const shareUrl = storefrontUrl(hostname);

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
                <bdi dir="ltr">{hostname}</bdi>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
            {/* Sharing the link is how merchants get their first customers —
                native share sheet on phones (any app), menu fallback elsewhere. */}
            <ShareButton
              url={shareUrl}
              message={t('common:share.store_message')}
              size="sm"
              className="flex-1 sm:flex-none"
            />
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
