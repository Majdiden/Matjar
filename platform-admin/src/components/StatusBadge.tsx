import { Badge } from './ui/Badge';

export const StatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  if (!status) return <Badge variant="outline">—</Badge>;
  const s = String(status);
  let variant: React.ComponentProps<typeof Badge>['variant'] = 'outline';
  if (s === 'active') variant = 'success';
  else if (s === 'trial') variant = 'secondary';
  else if (s === 'pending') variant = 'secondary';
  else if (s === 'past_due') variant = 'warning';
  else if (s === 'suspended' || s === 'cancelled' || s === 'deleted') variant = 'destructive';
  return (
    <Badge variant={variant} className="capitalize">
      {s.replace(/_/g, ' ')}
    </Badge>
  );
};
