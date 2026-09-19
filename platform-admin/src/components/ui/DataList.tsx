import React from 'react';
import { cn } from '../../lib/utils';
import { Table, THead, TBody, TR, TH, TD } from './Table';

/**
 * Generic list: a real <table> on md+ and stacked cards on phones (wide
 * tables do not fit a 390px viewport). Columns are declared once and drive
 * both renderings:
 *
 *   - `primary` (or the first column) becomes the card title.
 *   - columns with NO header are treated as action columns and render in the
 *     card's top-end corner without a label.
 *   - every other column becomes a label/value pair in a 2-col <dl>.
 *   - `hideOnMobile` drops a column from the card entirely.
 */
export type DataListAlign = 'start' | 'center' | 'end';

export interface DataListColumn<T> {
  id: string;
  header?: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /** Card title on mobile (defaults to the first column). */
  primary?: boolean;
  /** Omit from the mobile card. */
  hideOnMobile?: boolean;
  align?: DataListAlign;
  /** Extra classes for the desktop <td>. */
  className?: string;
  /** Extra classes for the desktop <th>. */
  headClassName?: string;
  /** Let the mobile value span both columns (long urls, reasons…). */
  fullWidthOnMobile?: boolean;
}

export interface DataListProps<T> {
  columns: DataListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
}

const alignClass: Record<DataListAlign, string | undefined> = {
  start: undefined,
  center: 'text-center',
  end: 'text-right',
};

export function DataList<T>({ columns, rows, rowKey, className, rowClassName }: DataListProps<T>) {
  const hasHeader = (c: DataListColumn<T>) => c.header !== undefined && c.header !== null && c.header !== '';
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const actionCols = columns.filter((c) => c !== primary && !hasHeader(c) && !c.hideOnMobile);
  const fieldCols = columns.filter((c) => c !== primary && hasHeader(c) && !c.hideOnMobile);

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className={cn('space-y-2 md:hidden', className)}>
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            className={cn('rounded-lg border bg-card p-3 shadow-sm', rowClassName?.(row))}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 text-sm font-medium [overflow-wrap:anywhere]">
                {primary?.cell(row)}
              </div>
              {actionCols.length > 0 && (
                <div className="-me-1 -mt-1 flex shrink-0 flex-wrap items-center justify-end gap-1">
                  {actionCols.map((c) => (
                    <React.Fragment key={c.id}>{c.cell(row)}</React.Fragment>
                  ))}
                </div>
              )}
            </div>
            {fieldCols.length > 0 && (
              <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2">
                {fieldCols.map((c) => (
                  <div
                    key={c.id}
                    className={cn('flex min-w-0 flex-col gap-0.5', c.fullWidthOnMobile && 'col-span-2')}
                  >
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {c.header}
                    </dt>
                    <dd className="min-w-0 text-sm [overflow-wrap:anywhere]">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className={cn('hidden rounded-lg border bg-card md:block', className)}>
        <Table>
          <THead>
            <TR>
              {columns.map((c) => (
                <TH key={c.id} className={cn(c.align && alignClass[c.align], c.headClassName)}>
                  {c.header}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={rowKey(row)} className={rowClassName?.(row)}>
                {columns.map((c) => (
                  <TD key={c.id} className={cn(c.align && alignClass[c.align], c.className)}>
                    {c.cell(row)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </>
  );
}
