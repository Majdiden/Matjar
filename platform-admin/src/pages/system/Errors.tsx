import { ExternalLink } from 'lucide-react';
import { SystemShell } from './SystemShell';
import { Button } from '../../components/ui/Button';

/**
 * Application errors are aggregated by Sentry (services/sentry, dashboard
 * sentry.ts). The console links out rather than duplicating an error
 * inspector; when no Sentry URL is configured we explain how to enable it.
 */
export default function Errors() {
  const sentryUrl = (import.meta.env.VITE_SENTRY_URL as string | undefined) || '';
  return (
    <SystemShell title="System" description="Aggregated application errors live in the error-tracking provider.">
      <div className="rounded-lg border bg-card p-4 text-sm">
        {sentryUrl ? (
          <div className="space-y-3">
            <p>Errors from the API, workers and both apps are tracked in Sentry.</p>
            <Button variant="outline" size="sm" onClick={() => window.open(sentryUrl, '_blank', 'noopener')}>
              <ExternalLink className="h-3.5 w-3.5" /> Open Sentry
            </Button>
          </div>
        ) : (
          <div className="space-y-2 text-muted-foreground">
            <p>No error-tracking dashboard is linked for this environment.</p>
            <p>
              Set <code className="rounded bg-muted px-1 py-0.5 text-xs">SENTRY_DSN</code> on the API and workers, and{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SENTRY_URL</code> (the project URL) on the platform admin build to
              link it here. The Integrations tab shows whether Sentry is configured.
            </p>
          </div>
        )}
      </div>
    </SystemShell>
  );
}
