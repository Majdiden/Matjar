import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Copy } from 'lucide-react';
import type { DomainRegistryRow } from '../types';

// =============================================================================
// DNS records table shown while a custom domain is pending DNS setup:
// the TXT ownership record and the CNAME/A routing record the merchant
// must add at their DNS provider.
// =============================================================================

export function DnsRecordsBlock({
  row,
  onCopy,
  t,
}: {
  row: DomainRegistryRow;
  onCopy: (text: string, label?: string) => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const records: Array<{
    type: string;
    name: string;
    value: string;
    purpose: string;
  }> = [];

  if (row.verification?.recordName && row.verification?.recordValue) {
    records.push({
      type: 'TXT',
      name: row.verification.recordName,
      value: row.verification.recordValue,
      purpose: t('domains:dns.purpose_ownership'),
    });
  }
  if (row.dns?.expectedTarget) {
    records.push({
      type: row.dns.targetType || 'CNAME',
      name: row.hostname,
      value: row.dns.expectedTarget,
      purpose: t('domains:dns.purpose_routing'),
    });
  }

  if (records.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('domains:dns.records_title')}</p>
        <span className="text-xs text-muted-foreground">
          {t('domains:dns.propagation_hint')}
        </span>
      </div>
      <div className="space-y-2">
        {records.map((rec, i) => (
          <div
            key={i}
            className="border rounded-lg p-3 bg-muted/20 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {rec.type}
              </Badge>
              <span className="text-xs text-muted-foreground">{rec.purpose}</span>
            </div>
            <DnsField label={t('domains:dns.field.name')} value={rec.name} onCopy={onCopy} />
            <DnsField label={t('domains:dns.field.value')} value={rec.value} onCopy={onCopy} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DnsField({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (text: string, copyLabel?: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-12 shrink-0">{label}</span>
      <code className="font-mono bg-background px-2 py-1 rounded border flex-1 truncate">
        {value}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => onCopy(value, `${label} copied`)}
        aria-label={`Copy ${label}`}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
