import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <Loader2 className={cn('h-4 w-4 animate-spin text-muted-foreground', className)} />
);

export const PageSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-16">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export const EmptyState: React.FC<{ title: string; description?: string; action?: React.ReactNode }> = ({
  title,
  description,
  action,
}) => (
  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
    <p className="text-sm font-medium text-foreground">{title}</p>
    {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const ErrorState: React.FC<{ error: string; onRetry?: () => void }> = ({ error, onRetry }) => (
  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
    <div className="font-medium">Something went wrong</div>
    <div className="mt-1 text-destructive/80">{error}</div>
    {onRetry && (
      <button onClick={onRetry} className="mt-2 text-sm font-medium underline hover:no-underline">
        Retry
      </button>
    )}
  </div>
);
