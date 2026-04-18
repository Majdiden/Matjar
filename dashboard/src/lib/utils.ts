import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escape a single CSV cell. Wraps in quotes when the value contains a
 * comma, quote, or newline. Empty / nullish values become empty strings.
 */
function csvCell(value: unknown): string {
  if (value == null) return ''
  const str = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Convert an array of objects into a CSV string. `columns` lets the caller
 * pick which fields to include and what to call them in the header row.
 */
export function toCSV<T extends object>(
  rows: T[],
  columns: Array<{ key: string; label: string; get?: (row: T) => unknown }>
): string {
  const header = columns.map((c) => csvCell(c.label)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) =>
          csvCell(c.get ? c.get(row) : (row as Record<string, unknown>)[c.key])
        )
        .join(',')
    )
    .join('\n')
  return body ? `${header}\n${body}` : header
}

/**
 * Trigger a browser download for the given CSV string. Uses a Blob + a
 * temporary anchor; cleaned up after the click. The filename automatically
 * gets a date suffix so successive exports don't overwrite each other.
 */
export function downloadCSV(csv: string, baseName: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `${baseName}-${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
