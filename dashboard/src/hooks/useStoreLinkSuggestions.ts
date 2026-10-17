import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';

/** Wait after the last keystroke in the store name before asking. */
const SUGGEST_DEBOUNCE_MS = 600;

/**
 * Short, free store links for a store name (GET /api/domains/suggest-subdomains):
 * «بيتنا أصل العطور السودانية» → bitna, betna, bitna-asl… instead of the whole
 * name spelled out. Null until the first answer, [] when there is none.
 */
export function useStoreLinkSuggestions(name: string): string[] | null {
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) { setSuggestions(null); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = (await api.domains.suggestSubdomains(trimmed)) as { data?: { suggestions?: string[] } };
        if (!cancelled) setSuggestions(res.data?.suggestions ?? []);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [name]);
  return suggestions;
}
