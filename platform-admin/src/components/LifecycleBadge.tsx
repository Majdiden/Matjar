import { Badge } from './ui/Badge';
import type { LifecycleState } from '../lib/api';

const VARIANT: Record<LifecycleState, React.ComponentProps<typeof Badge>['variant']> = {
  pending: 'secondary',
  onboarding: 'secondary',
  active: 'success',
  suspended: 'warning',
  closed: 'destructive',
  archived: 'outline',
};

/** Explicit store lifecycle state (tenant.lifecycle.state). */
export const LifecycleBadge: React.FC<{ state?: string | null; className?: string }> = ({ state, className }) => {
  if (!state) return <Badge variant="outline" className={className}>—</Badge>;
  const s = state as LifecycleState;
  return (
    <Badge variant={VARIANT[s] || 'outline'} className={`capitalize ${className || ''}`}>
      {s}
    </Badge>
  );
};
