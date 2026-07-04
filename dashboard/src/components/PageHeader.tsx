import React from 'react';
import { cn } from '../lib/utils';

export interface PageHeaderProps {
  title: React.ReactNode;
  /** Optional one-line description rendered under the title. */
  description?: React.ReactNode;
  /** Optional action slot (buttons, links) rendered at the end of the row. */
  actions?: React.ReactNode;
  className?: string;
}

// Shared page header. Title scale is standardized to
// `text-2xl font-semibold tracking-tight` (audit 3.8.4) — the breadcrumb
// already states location, so the oversized `text-3xl font-bold` is demoted.
export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, className }) => (
  <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4', className)}>
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
