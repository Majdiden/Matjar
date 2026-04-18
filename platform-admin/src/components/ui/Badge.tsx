import React from 'react';
import { cn } from '../../lib/utils';

type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

const variantStyles: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
  outline: 'border border-border text-foreground',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
};

export const Badge: React.FC<
  React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }
> = ({ variant = 'default', className, ...props }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      variantStyles[variant],
      className
    )}
    {...props}
  />
);
