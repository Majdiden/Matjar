import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'pagination';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /** Max page buttons to show */
  maxButtons?: number;
}

export function Pagination(props: PaginationProps) {
  const Override = useThemeSlot<React.ComponentType<PaginationProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('nav');
  const {
    currentPage,
    totalPages,
    onPageChange,
    className,
    maxButtons = 5,
  } = props;
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + maxButtons - 1);

  if (end - start + 1 < maxButtons) {
    start = Math.max(1, end - maxButtons + 1);
  }

  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push('ellipsis');
  }

  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) pages.push(i);
  }

  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav aria-label={t('pagination.aria')} className={cn('flex items-center gap-1', className)}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label={t('pagination.previous')}
      >
        <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-2 text-gray-400">&hellip;</span>
        ) : (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              'min-w-[2.25rem] h-9 rounded-lg text-sm font-medium transition',
              page === currentPage
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
        aria-label={t('pagination.next')}
      >
        <svg className="w-4 h-4 rtl:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </nav>
  );
}
