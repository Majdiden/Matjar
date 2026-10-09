/**
 * The store's single top strip (announcement bar), shown above the header on
 * every page. One source for every theme: the theme-level settings
 * `show_announcement_bar` and `announcement_text` (with its `__ar` twin),
 * edited from My Store → Homepage. Each theme keeps its own markup and only
 * asks this hook what to show.
 *
 * Only the merchant's own text is shown: no placeholder copy such as "Free
 * shipping over $50", which would promise things the store may not offer.
 */
import type { ReactNode } from 'react';
import { useThemeSetting } from './ThemeProvider';

/** Preview anchor of the top strip (the homepage editor scrolls to and picks it). */
export const TOP_STRIP_ANCHOR = 'top-strip';

/** Theme-level setting keys every manifest declares for the top strip. */
export const TOP_STRIP_SETTINGS = Object.freeze({
  show: 'show_announcement_bar',
  text: 'announcement_text',
});

/** The strip's text, or null when it is switched off or empty. */
export function useTopStripText(): string | null {
  const show = useThemeSetting<boolean>(TOP_STRIP_SETTINGS.show) !== false;
  const text = useThemeSetting<string>(TOP_STRIP_SETTINGS.text);
  if (!show || typeof text !== 'string') return null;
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

/**
 * Wraps a homepage section (or the top strip) so the dashboard preview can
 * scroll to it and the merchant can tap it to edit (`data-section-id`).
 * Themes that render through SectionRenderer get this automatically.
 */
export function SectionAnchor({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <div data-section-id={id} className={className ?? 'scroll-mt-20'}>
      {children}
    </div>
  );
}
