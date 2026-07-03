import React from 'react';
import { Card, CardContent } from './ui/card';
import { cn } from '../lib/utils';

export interface EmptyStateProps {
  /** Lucide icon (or any component rendering an svg). */
  icon?: React.ElementType;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Call-to-action slot (typically a Button). */
  action?: React.ReactNode;
  className?: string;
}

// Shared empty state (generalized from the local one in domains/Domains.tsx):
// dashed card, muted icon disc, title, hint, optional CTA.
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className }) => (
  <Card className={cn('border-dashed', className)}>
    <CardContent className="py-10 text-center space-y-3">
      {Icon && (
        <div className="h-12 w-12 mx-auto rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        )}
      </div>
      {action}
    </CardContent>
  </Card>
);
