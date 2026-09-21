import type { BadgeVariant } from '../../lib/api';
import type { IncidentSeverity, IncidentStatus } from '../../lib/api-incidents';

export function severityVariant(s: IncidentSeverity): BadgeVariant {
  if (s === 'sev1') return 'destructive';
  if (s === 'sev2') return 'warning';
  return 'secondary';
}
export function statusVariant(s: IncidentStatus): BadgeVariant {
  if (s === 'resolved') return 'success';
  if (s === 'monitoring') return 'outline';
  return 'warning';
}
