import React from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../../../components/ui/input';
import type { Order, OrderItem } from '../../../../types';

// ─── Line picker (shared by replacement + return dialogs) ────────────
// Both flows pick a subset of order lines with quantities. The bounds
// differ — replacement is capped by the ordered quantity, return is
// capped by the fulfilled (received) quantity — so the parent passes
// `maxOf` as an accessor.
export const LinePicker: React.FC<{
  order: Order;
  picks: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  maxOf: (line: OrderItem) => number;
  labelMax: string;
}> = ({ order, picks, onChange, maxOf, labelMax }) => {
  const { t: tLP } = useTranslation(['orders', 'common']);
  const rows = order.products
    .map((line) => ({ line, id: String(line._id), max: maxOf(line) }))
    .filter((row) => row.id && row.max > 0);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
        {tLP('orders:validation.no_eligible_items')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map(({ line, id, max }) => {
        const name = typeof line.product === 'object' ? line.product.name : line.name || 'Item';
        const current = picks[id] ?? 0;
        return (
          <div
            key={id}
            className="flex items-center justify-between gap-3 text-sm border rounded-md p-2.5"
          >
            <span className="flex-1 truncate">{name}</span>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {tLP('orders:detail.line_picker.max_label', { max, labelMax })}
            </span>
            <Input
              type="number"
              min={0}
              max={max}
              value={current}
              onChange={(e) => {
                const v = Math.max(0, Math.min(max, parseInt(e.target.value) || 0));
                onChange({ ...picks, [id]: v });
              }}
              className="h-8 w-20"
            />
          </div>
        );
      })}
    </div>
  );
};
