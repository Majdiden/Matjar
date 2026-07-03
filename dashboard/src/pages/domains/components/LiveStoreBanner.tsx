import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';

// =============================================================================
// Green live-store banner: big "your store is live at" card with
// Copy + Visit store buttons. Currently used by the Domains page only,
// but self-contained so it can be promoted to a shared component.
// =============================================================================

export interface LiveStoreBannerProps {
  /** Hostname the store is live at (no protocol). Renders nothing when empty. */
  hostname: string;
  /** Called with the hostname when the Copy button is pressed. */
  onCopy: (hostname: string) => void;
}

export const LiveStoreBanner: React.FC<LiveStoreBannerProps> = ({
  hostname,
  onCopy,
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
              onClick={() => window.open(`https://${hostname}`, '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1.5" />
              {t('domains:list.hero.visit')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
