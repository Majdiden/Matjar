import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatDate, formatRelative } from '../../lib/utils';

/**
 * Store overview cards shared by the full store page (TenantDetail) and the
 * promoter's reduced store page (PBI 10-47): setup progress, domains and the
 * store's data, plus the KPI tile and label/value row they are built from.
 */

type SetupStep = {
  status?: string;
  error?: string | null;
  reason?: string | null;
  completedAt?: string | null;
  products?: number;
  categories?: number;
  collections?: number;
  pages?: number;
  draft?: boolean;
};

export interface OverviewTenant {
  slug: string;
  domains?: {
    subdomain?: { name?: string; fullDomain?: string };
    customDomain?: { name?: string; isVerified?: boolean };
    primaryDomain?: 'subdomain' | 'custom';
  } | null;
  setupStatus?: {
    status?: string;
    steps?: Record<string, SetupStep>;
    startedAt?: string | null;
    completedAt?: string | null;
    lastError?: string | null;
  } | null;
  settings?: { activeTheme?: string | null; niche?: string | null };
  lastLoginAt?: string | null;
  lastLoginBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export function SetupCard({ tenant }: { tenant: OverviewTenant }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row
          label="Status"
          value={
            tenant.setupStatus?.status ? (
              <span className="capitalize">
                {String(tenant.setupStatus.status).replace(/_/g, ' ')}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Row
          label="Started"
          value={
            tenant.setupStatus?.startedAt ? formatDate(tenant.setupStatus.startedAt) : '—'
          }
        />
        <Row
          label="Completed"
          value={
            tenant.setupStatus?.completedAt
              ? formatDate(tenant.setupStatus.completedAt)
              : '—'
          }
        />
        {tenant.setupStatus?.lastError && (
          <Row label="Last error" value={tenant.setupStatus.lastError} />
        )}
        {tenant.setupStatus?.steps && (
          <div className="pt-2">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Steps</div>
            <ul className="space-y-1 text-xs">
              {Object.entries(tenant.setupStatus.steps).map(([key, val]) => (
                <li key={key}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="capitalize text-muted-foreground">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="capitalize">
                      {val?.status ? val.status.replace(/_/g, ' ') : '—'}
                    </span>
                  </div>
                  {val?.reason && (
                    <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
                      {val.reason}
                    </div>
                  )}
                  {key === 'data_seeding' && val?.status === 'completed' && typeof val.products === 'number' && (
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {val.products} products · {val.categories ?? 0} categories · {val.collections ?? 0} collections · {val.pages ?? 0} pages
                      {val.draft ? ' (draft)' : ''}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>  );
}

export function DomainsCard({ tenant }: { tenant: OverviewTenant }) {
  return (

    <Card>
      <CardHeader>
        <CardTitle>Domains</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Slug" value={<code className="text-xs">{tenant.slug}</code>} />
        <Row
          label="Subdomain"
          value={tenant.domains?.subdomain?.fullDomain || tenant.domains?.subdomain?.name || '—'}
        />
        <Row
          label="Custom"
          value={
            tenant.domains?.customDomain?.name ? (
              <span>
                {tenant.domains.customDomain.name}{' '}
                {tenant.domains.customDomain.isVerified ? (
                  <Badge variant="success" className="ml-1">
                    verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="ml-1">
                    pending
                  </Badge>
                )}
              </span>
            ) : (
              '—'
            )
          }
        />
        <Row label="Primary" value={tenant.domains?.primaryDomain || 'subdomain'} />
      </CardContent>
    </Card>  );
}

export function DataCard({ tenant, note }: { tenant: OverviewTenant; note?: string }) {
  return (

    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
        <Row label="Active theme" value={tenant.settings?.activeTheme || '—'} />
        <Row label="Niche" value={tenant.settings?.niche || '—'} />
        <Row
          label="Last merchant login"
          value={
            tenant.lastLoginAt
              ? `${formatRelative(tenant.lastLoginAt)} (${formatDate(tenant.lastLoginAt)})${tenant.lastLoginBy ? ` · ${tenant.lastLoginBy}` : ''}`
              : 'never'
          }
        />
        <Row label="Created" value={formatDate(tenant.createdAt)} />
        <Row label="Updated" value={formatDate(tenant.updatedAt)} />
      </CardContent>
    </Card>  );
}

export const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
    <span className="shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0 [overflow-wrap:anywhere] sm:text-right">{value}</span>
  </div>
);

export const KpiTile: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: string;
  onClick?: () => void;
}> = ({ label, value, icon, tone, onClick }) => {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`rounded-lg border bg-card p-3 text-left transition-colors ${
        clickable ? 'hover:bg-accent' : 'cursor-default'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={tone || 'text-muted-foreground'}>{icon}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold ${tone || ''}`}>{value}</div>
    </button>
  );
};
