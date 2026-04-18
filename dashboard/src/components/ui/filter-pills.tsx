/**
 * FilterPills — unified pill-style filter control used across list pages
 * (Orders, Products, Customers, Inventory, Reviews). One source of truth so
 * filter rows look and feel identical everywhere.
 *
 * Each pill is rounded-full, with the active pill filled in primary and the
 * rest outlined. Optional leading icon and trailing count badge per pill.
 */
import React from 'react';
import { cn } from '../../lib/utils';

export interface FilterPillItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ElementType;
  count?: number;
}

interface FilterPillsProps<T extends string = string> {
  items: FilterPillItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

export function FilterPills<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: FilterPillsProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto py-1.5 -my-1.5 -mx-1 px-1 scrollbar-thin',
        className,
      )}
      role="tablist"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 h-8 text-xs font-medium transition-colors',
              'border focus:outline-none focus:ring-2 focus:ring-primary/30',
              active
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'ml-1 inline-flex items-center justify-center rounded-full px-1.5 h-4 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default FilterPills;
