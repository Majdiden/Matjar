import { Link } from 'react-router-dom';

/**
 * Horizontal bar list: label + value with a proportional bar behind it.
 * Used for "top stores", distributions and plan breakdowns. Mobile-first:
 * every row is a full-width flex line, so it never overflows.
 */
export interface BarListRow {
  key: string;
  label: string;
  value: number;
  /** Pre-formatted value text (e.g. money); defaults to the number. */
  display?: string;
  href?: string;
  hint?: string;
}

export const BarList: React.FC<{ rows: BarListRow[]; empty?: string; tone?: string }> = ({ rows, empty = 'No data', tone = 'bg-primary/15' }) => {
  if (!rows.length) return <div className="py-4 text-center text-sm text-muted-foreground">{empty}</div>;
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        const inner = (
          <>
            <div className={`absolute inset-y-0 start-0 rounded ${tone}`} style={{ width: `${pct}%` }} aria-hidden />
            <div className="relative flex items-baseline justify-between gap-3 px-2 py-1 text-sm">
              <span className="min-w-0 truncate">
                {r.label}
                {r.hint && <span className="ms-1 text-[11px] text-muted-foreground">{r.hint}</span>}
              </span>
              <span className="shrink-0 tabular-nums font-medium">{r.display ?? r.value.toLocaleString()}</span>
            </div>
          </>
        );
        const cls = 'relative block overflow-hidden rounded';
        return (
          <li key={r.key}>
            {r.href ? (
              <Link to={r.href} className={`${cls} hover:bg-accent/40`}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
};
