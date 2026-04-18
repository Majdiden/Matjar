import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelative(value?: string | Date | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ${diff > 0 ? 'ago' : 'from now'}`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ${diff > 0 ? 'ago' : 'from now'}`;
  const days = Math.round(hrs / 24);
  return `${days}d ${diff > 0 ? 'ago' : 'from now'}`;
}

export function formatMoney(cents?: number | null, currency = 'SDG'): string {
  if (cents == null || Number.isNaN(cents)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function shortId(id?: string | null): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}
