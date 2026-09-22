import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { prefersReducedMotion } from '../../lib/motion';

/** Parses the global "one message per line" announcement setting. */
export function useAnnouncementMessages(): string[] {
  const { t } = useTranslation(['theme']);
  const raw = useThemeSetting<string>('announcement_text') || '';
  const set = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (set.length) return set;
  // Not configured → the shipped demo lines, translated.
  const fallback = t('theme.global.announcement', { returnObjects: true }) as unknown;
  return Array.isArray(fallback) ? (fallback as string[]) : [];
}

/** Rotates one message at a time with a 400ms crossfade. */
const AnnouncementBar: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const show = useThemeSetting<boolean>('show_announcement_bar');
  const interval = Number(useThemeSetting<number>('autoplay_interval') || 4000);
  const messages = useAnnouncementMessages();
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (messages.length < 2 || prefersReducedMotion()) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setI((n) => (n + 1) % messages.length); setVisible(true); }, 400);
    }, interval);
    return () => clearInterval(id);
  }, [messages.length, interval]);

  if (show === false || messages.length === 0) return null;
  return (
    <div className={`px-4 py-2 text-center text-[12px] font-semibold uppercase tracking-[0.14em] ${dark ? 'bg-[#1c1c1c] text-white' : 'bg-[color:var(--color-accent)] text-[#1c1c1c]'}`} role="status" aria-live="polite">
      <span className="inline-block transition-opacity duration-[400ms] ease-linear" style={{ opacity: visible ? 1 : 0 }}>{messages[i % messages.length]}</span>
    </div>
  );
};

export default AnnouncementBar;
