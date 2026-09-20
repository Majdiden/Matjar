import { NavLink } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { HealthStatus, IntegrationHealth } from '../../lib/api-system';
import { Badge } from '../../components/ui/Badge';

const TABS = [
  { to: '/system/health', label: 'Health' },
  { to: '/system/integrations', label: 'Integrations' },
  { to: '/system/webhooks', label: 'Webhooks' },
  { to: '/system/errors', label: 'Errors' },
];

/** Header + horizontally scrollable tab strip shared by the System pages. */
export function SystemShell({ title, description, actions, children }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Activity className="mt-1 h-6 w-6 shrink-0 text-indigo-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="border-b">
        <div className="-mb-px flex gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  'border-b-2 px-3 py-2 text-sm transition-colors',
                  isActive ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: HealthStatus | IntegrationHealth | string }) {
  const variant: React.ComponentProps<typeof Badge>['variant'] =
    status === 'ok' ? 'success' : status === 'degraded' ? 'warning' : status === 'down' ? 'destructive' : 'outline';
  return (
    <Badge variant={variant} className="capitalize">
      {String(status).replace(/_/g, ' ')}
    </Badge>
  );
}
