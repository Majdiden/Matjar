import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import type { BreadcrumbItem } from '../../types/components';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'breadcrumbs';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  className?: string;
}

export function Breadcrumbs(props: BreadcrumbsProps) {
  const Override = useThemeSlot<React.ComponentType<BreadcrumbsProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { items, separator, className } = props;
  const sep = separator || (
    <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-2 text-sm', className)}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-400">{sep}</span>}
          {item.href && i < items.length - 1 ? (
            <Link to={item.href} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
