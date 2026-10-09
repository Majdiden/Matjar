import React from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { TOP_STRIP_ANCHOR, useTopStripText } from '@matjar/theme-shared/theme/topStrip';

/** Parses the global announcement setting into lines (the Ticker section's fallback copy). */
export function useAnnouncementMessages(): string[] {
  const { t } = useTranslation(['theme']);
  const raw = useThemeSetting<string>('announcement_text') || '';
  const set = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (set.length) return set;
  // Not configured → the shipped demo lines, translated.
  const fallback = t('theme.global.announcement', { returnObjects: true }) as unknown;
  return Array.isArray(fallback) ? (fallback as string[]) : [];
}

/** The store's single top strip: the merchant's text from My Store, nothing when off or empty. */
const AnnouncementBar: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const text = useTopStripText();
  if (!text) return null;
  return (
    <div data-section-id={TOP_STRIP_ANCHOR} className={`px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] ${dark ? 'bg-[#1c1c1c] text-white' : 'bg-[color:var(--color-accent)] text-[#1c1c1c]'}`} role="status">
      <span className="inline-block">{text}</span>
    </div>
  );
};

export default AnnouncementBar;
