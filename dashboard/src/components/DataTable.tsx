import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from './ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

// Generic typed table over the ui/table primitives (audit 3.1.2).
// Hand-composed on purpose — the list pages share one consistent pattern
// (modeled on orders/Orders.tsx and products/Products.tsx), so a thin
// shared component suffices. Do NOT swap this for TanStack Table.

export type DataTableAlign = 'start' | 'center' | 'end';
export type DataTableBreakpoint = 'sm' | 'md' | 'lg' | 'xl';

const alignClass: Record<DataTableAlign, string | undefined> = {
  start: undefined,
  center: 'text-center',
  end: 'text-end',
};

// Literal class strings so Tailwind's scanner picks them up.
const hideClass: Record<DataTableBreakpoint, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export interface DataTableColumn<T> {
  id: string;
  /** i18n key for the header label (may include a namespace, e.g. "orders:list.column.order"). */
  headerKey?: string;
  /** Pre-rendered header node; takes precedence over headerKey. */
  header?: React.ReactNode;
  align?: DataTableAlign;
  /** Hide this column below the given breakpoint. */
  hideBelow?: DataTableBreakpoint;
  headClassName?: string;
  cellClassName?: string | ((row: T) => string | undefined);
  cell: (row: T) => React.ReactNode;
}

export interface DataTablePaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  /** Number of skeleton rows shown while loading. */
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Selection: pass both `selected` and `onSelectedChange` to enable the checkbox column. */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
  /** Bulk-action bar slot, rendered above the table while rows are selected. */
  bulkBar?: React.ReactNode;
  /** Empty-state slot, rendered instead of the table when there are no rows. */
  empty?: React.ReactNode;
  /** Integrated pagination footer (rendered when pages > 1). */
  pagination?: DataTablePaginationState;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  onRowClick,
  rowClassName,
  selected,
  onSelectedChange,
  bulkBar,
  empty,
  pagination,
  onPageChange,
  className,
}: DataTableProps<T>) {
  const { t } = useTranslation('common');
  const selectable = !!selected && !!onSelectedChange;

  const toggleSelect = (id: string) => {
    if (!selected || !onSelectedChange) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelectedChange(next);
  };

  const toggleSelectAll = () => {
    if (!selected || !onSelectedChange) return;
    if (selected.size === rows.length) onSelectedChange(new Set());
    else onSelectedChange(new Set(rows.map(rowKey)));
  };

  const colClasses = (col: DataTableColumn<T>) =>
    cn(col.align && alignClass[col.align], col.hideBelow && hideClass[col.hideBelow]);

  if (!loading && rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <>
      {bulkBar && selectable && selected!.size > 0 && bulkBar}

      <Card className={className}>
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-[40px]">
                  <input
                    type="checkbox"
                    checked={selected!.size === rows.length && rows.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
              )}
              {columns.map((col) => (
                <TableHead key={col.id} className={cn(colClasses(col), col.headClassName)}>
                  {col.header ?? (col.headerKey ? t(col.headerKey as Parameters<typeof t>[0]) : null)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {selectable && (
                      <TableCell>
                        <Skeleton className="h-4 w-4" />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.id} className={colClasses(col)}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : rows.map((row) => {
                  const id = rowKey(row);
                  const isSelected = !!selected?.has(id);
                  return (
                    <TableRow
                      key={id}
                      className={cn(
                        onRowClick && 'cursor-pointer',
                        isSelected && 'bg-primary/5',
                        rowClassName?.(row),
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn(
                            colClasses(col),
                            typeof col.cellClassName === 'function'
                              ? col.cellClassName(row)
                              : col.cellClassName,
                          )}
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </Card>

      {pagination && onPageChange && pagination.pages > 1 && !loading && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              {t('action.previous')}
            </Button>
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={pagination.page === p ? 'default' : 'outline'}
                size="sm"
                className="w-9"
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.pages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              {t('action.next')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
