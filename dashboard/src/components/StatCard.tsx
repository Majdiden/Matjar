import React from 'react';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';

export type StatDeltaTrend = 'up' | 'down' | 'neutral';

export interface StatCardDelta {
  /** Pre-formatted delta text, e.g. "+12%". */
  label: string;
  trend?: StatDeltaTrend;
}

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small muted line under the value. */
  description?: React.ReactNode;
  /** Lucide icon rendered muted at the end of the label row. */
  icon?: React.ElementType;
  /** Optional delta chip rendered next to the value. */
  delta?: StatCardDelta;
  className?: string;
}

const trendClass: Record<StatDeltaTrend, string> = {
  up: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  down: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  neutral: 'bg-muted text-muted-foreground',
};

// Shared stat card (audit 3.8.4): label, value in
// `tabular-nums tracking-tight text-2xl font-semibold`, optional delta
// chip, optional muted icon.
export const StatCard: React.FC<StatCardProps> = ({ label, value, description, icon: Icon, delta, className }) => (
  <Card className={cn('hover:shadow-md transition-shadow', className)}>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="tabular-nums tracking-tight text-2xl font-semibold">{value}</p>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium',
              trendClass[delta.trend ?? 'neutral'],
            )}
          >
            {delta.label}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </CardContent>
  </Card>
);
