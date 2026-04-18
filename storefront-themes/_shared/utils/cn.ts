/**
 * Utility for merging Tailwind CSS classes.
 * Uses clsx for conditional classes — no tailwind-merge dependency to keep SDK light.
 */
export function cn(...inputs: Array<string | undefined | null | false | Record<string, boolean>>): string {
  const classes: string[] = [];

  for (const input of inputs) {
    if (!input) continue;
    if (typeof input === 'string') {
      classes.push(input);
    } else if (typeof input === 'object') {
      for (const [key, value] of Object.entries(input)) {
        if (value) classes.push(key);
      }
    }
  }

  return classes.join(' ');
}
