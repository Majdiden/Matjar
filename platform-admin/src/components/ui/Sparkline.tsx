import { useMemo } from 'react';

/**
 * Tiny inline SVG line/area chart. Pure presentation: pass the numeric
 * values in order; it scales to its container width (viewBox) and shows the
 * last value as a dot. No axes — pair it with a Tile label and total.
 */
export const Sparkline: React.FC<{
  values: number[];
  height?: number;
  className?: string;
  stroke?: string;
  fill?: string;
  /** Accessible summary read by screen readers. */
  label?: string;
}> = ({ values: rawValues, height = 40, className, stroke = 'currentColor', fill = 'currentColor', label }) => {
  const W = 200;
  // Non-finite points (NaN/Infinity from a bad payload) are dropped so the
  // path stays valid instead of rendering nothing.
  const values = useMemo(() => rawValues.filter((v) => Number.isFinite(v)), [rawValues]);
  const H = height;
  const pad = 3;
  const { path, area, last } = useMemo(() => {
    const n = values.length;
    if (n === 0) return { path: '', area: '', last: null as null | { x: number; y: number } };
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const x = (i: number) => (n === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (n - 1));
    const y = (v: number) => H - pad - ((v - min) / span) * (H - 2 * pad);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const p = `M${pts.join(' L')}`;
    const a = `${p} L${x(n - 1).toFixed(1)},${(H - pad).toFixed(1)} L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`;
    return { path: p, area: a, last: { x: x(n - 1), y: y(values[n - 1]) } };
  }, [values, H]);

  if (!values.length) return <div className={className} style={{ height }} />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={className} style={{ width: '100%', height }} role="img" aria-label={label}>
      <path d={area} fill={fill} fillOpacity={0.12} stroke="none" />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last.x} cy={last.y} r={2.5} fill={stroke} vectorEffect="non-scaling-stroke" />}
    </svg>
  );
};
