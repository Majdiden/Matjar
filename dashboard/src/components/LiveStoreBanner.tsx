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

export const LiveStoreBanner: React.FC<LiveStoreBannerProps> = ({
  hostname,
  onCopy,
  manageTo,
}) => {
  const { t } = useTranslation(['domains', 'common']);

  if (!hostname) return null;
  return (
    <Card className="border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/10">
      <CardContent className="py-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground">
              {t('domains:list.hero.live_at')}
            </p>
            <p
              className="font-mono text-xl md:text-2xl font-semibold truncate mt-0.5"
              title={hostname}
            >
              {hostname}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => onCopy(hostname)}>
              <Copy className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.hero.copy')}
            </Button>
            <Button
              size="sm"
              onClick={() => window.open(storefrontUrl(hostname), '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.hero.visit')}
            </Button>
            {manageTo && (
              <Button variant="link" size="sm" className="text-muted-foreground" asChild>
                <Link to={manageTo}>{t('domains:list.hero.manage')}</Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
