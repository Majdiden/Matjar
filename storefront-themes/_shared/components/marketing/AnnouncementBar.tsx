import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'announcementBar';

interface AnnouncementBarProps {
  message: string;
  /** Link URL */
  href?: string;
  linkText?: string;
  dismissible?: boolean;
  className?: string;
  /** Background color (default: uses --color-primary) */
  bgColor?: string;
  textColor?: string;
  /** Storage key for dismiss state */
  storageKey?: string;
}

export function AnnouncementBar(props: AnnouncementBarProps) {
  const Override = useThemeSlot<React.ComponentType<AnnouncementBarProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('marketing');
  const {
    message,
    href,
    linkText,
    dismissible = true,
    className,
    bgColor,
    textColor,
    storageKey = 'matjar_announcement_dismissed',
  } = props;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true'; }
    catch { return false; }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, 'true'); } catch {}
  };

  return (
    <div
      className={cn('relative flex items-center justify-center px-4 py-2 text-sm font-medium', className)}
      style={{
        backgroundColor: bgColor || 'var(--color-primary, #2563eb)',
        color: textColor || 'white',
      }}
    >
      <span>{message}</span>
      {href && linkText && (
        <a href={href} className="ms-2 underline hover:no-underline font-semibold">
          {linkText}
        </a>
      )}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className="absolute end-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition"
          aria-label={t('announcement.dismiss_aria')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
