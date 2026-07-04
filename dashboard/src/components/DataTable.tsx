import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from './ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { Skeleton } from './ui/skeleton';
import { Button } from './ui/button';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
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

export type DataTableSortDir = 'asc' | 'desc';

export interface DataTableSortState {
  /** Matches a column's `sortKey` (usually the backend field name). */
  key: string;
  dir: DataTableSortDir;
}

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
  /**
   * Server-side sort field for this column (e.g. "createdAt"). When set —
   * and the table received `onSortChange` — the header becomes a click
   * target that cycles asc/desc for this key.
   */
  sortKey?: string;
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
  /** Current server-side sort; pair with `onSortChange` + column `sortKey`. */
  sort?: DataTableSortState;
  onSortChange?: (next: DataTableSortState) => void;
  className?: string;
  /**
   * Custom mobile (below `md`) card renderer. When omitted, DataTable
   * auto-builds a stacked card from the columns (first column as the title,
   * header-less columns as corner actions, the rest as labelled fields).
   * Pass `false` to keep the table on mobile (horizontally scrollable).
   */
  renderMobileCard?: ((row: T) => React.ReactNode) | false;
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
  sort,
  onSortChange,
  className,
  renderMobileCard,
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

  // Click cycles: inactive → asc → desc → asc … (server-side sort only;
  // the table never reorders rows itself).
  const handleSortClick = (sortKey: string) => {
    if (!onSortChange) return;
    const nextDir: DataTableSortDir =
      sort?.key === sortKey && sort.dir === 'asc' ? 'desc' : 'asc';
    onSortChange({ key: sortKey, dir: nextDir });
  };

  const renderHeaderLabel = (col: DataTableColumn<T>) =>
    col.header ?? (col.headerKey ? t(col.headerKey as Parameters<typeof t>[0]) : null);

  const renderHeader = (col: DataTableColumn<T>) => {
    if (!col.sortKey || !onSortChange) return renderHeaderLabel(col);
    const isActive = sort?.key === col.sortKey;
    const SortIcon = isActive ? (sort!.dir === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
    return (
      <button
        type="button"
        onClick={() => handleSortClick(col.sortKey!)}
        className={cn(
          'inline-flex items-center gap-1 -mx-1 px-1 rounded hover:text-foreground transition-colors',
          isActive && 'text-foreground',
        )}
      >
        {renderHeaderLabel(col)}
        <SortIcon className={cn('h-3.5 w-3.5', !isActive && 'opacity-50')} />
      </button>
    );
  };

  if (!loading && rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  // A column with neither `header` nor `headerKey` is an action/utility column
  // (e.g. a row menu) — on the mobile card it renders in the top-end corner
  // without a label; labelled columns become fields.
  const hasHeader = (col: DataTableColumn<T>) => col.header !== undefined || !!col.headerKey;
  const primaryCol = columns[0];
  const actionCols = columns.slice(1).filter((c) => !hasHeader(c));
  const fieldCols = columns.slice(1).filter(hasHeader);

  // Default mobile card built from the columns (used unless the caller passes
  // a custom `renderMobileCard` or opts out with `false`).
  const defaultMobileCard = (row: T) => {
    const id = rowKey(row);
    const isSelected = !!selected?.has(id);
    return (
      <Card
        key={id}
        className={cn(
          'transition-shadow',
          onRowClick && 'cursor-pointer hover:shadow-md active:bg-muted/40',
          isSelected && 'border-primary/50 bg-primary/5',
          rowClassName?.(row),
        )}
        onClick={onRowClick ? () => onRowClick(row) : undefined}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-2.5">
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
                />
              )}
              <div className="min-w-0 font-semibold">{primaryCol?.cell(row)}</div>
            </div>
            {actionCols.length > 0 && (
              <div className="-me-1 -mt-1 flex shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                {actionCols.map((col) => (
                  <React.Fragment key={col.id}>{col.cell(row)}</React.Fragment>
                ))}
              </div>
            )}
          </div>
          {fieldCols.length > 0 && (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
              {fieldCols.map((col) => (
                <div key={col.id} className="flex min-w-0 flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{renderHeaderLabel(col)}</dt>
                  <dd className="min-w-0 truncate text-sm">{col.cell(row)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    );
  };

  const cardRenderer = renderMobileCard === false ? null : (renderMobileCard || defaultMobileCard);

  return (
    <>
      {bulkBar && selectable && selected!.size > 0 && bulkBar}

      {/* Mobile: stacked cards (wide tables don't fit a 360px phone). Opt out
          with renderMobileCard={false} to keep the scrollable table. */}
      {cardRenderer && (
        <div className="space-y-2 md:hidden">
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <Card key={`m-skel-${i}`}>
                  <CardContent className="space-y-2 p-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))
            : rows.map((row) => (renderMobileCard ? (
                <React.Fragment key={rowKey(row)}>{renderMobileCard(row)}</React.Fragment>
              ) : defaultMobileCard(row)))}
        </div>
      )}

      <Card className={cn(cardRenderer && 'hidden md:block', 'overflow-x-auto', className)}>
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
                <TableHead
                  key={col.id}
                  className={cn(colClasses(col), col.headClassName)}
                  aria-sort={
                    col.sortKey && sort?.key === col.sortKey
                      ? sort.dir === 'asc' ? 'ascending' : 'descending'
                      : undefined
                  }
                >
                  {renderHeader(col)}
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
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
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
