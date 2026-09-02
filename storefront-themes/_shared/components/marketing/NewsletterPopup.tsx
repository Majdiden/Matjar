import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { Modal } from '../primitives/Modal';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'newsletterPopup';

interface NewsletterPopupProps {
  /** Delay in ms before showing (default: 5000) */
  delay?: number;
  /** Storage key to track "don't show again" */
  storageKey?: string;
  title?: string;
  description?: string;
  /** Image URL for side panel */
  image?: string;
  className?: string;
  onSubmit?: (email: string) => Promise<void>;
}

export function NewsletterPopup(_props: NewsletterPopupProps) {
  // Newsletter capture removed platform-wide (product decision) — never render.
  return null;
}

// Legacy implementation retained for reference; not used.
function NewsletterPopupLegacy(props: NewsletterPopupProps) {
  const Override = useThemeSlot<React.ComponentType<NewsletterPopupProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('marketing');
  const {
    delay = 5000,
    storageKey = 'matjar_newsletter_dismissed',
    title,
    description,
    image,
    className,
    onSubmit,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey) === 'true') return;
    } catch { return; }

    const timer = setTimeout(() => setIsOpen(true), delay);
    return () => clearTimeout(timer);
  }, [delay, storageKey]);

  const handleClose = () => {
    setIsOpen(false);
    try { localStorage.setItem(storageKey, 'true'); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      await onSubmit?.(email);
      setStatus('success');
      setTimeout(handleClose, 2000);
    } catch {
      setStatus('error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md" className={className}>
      <div className={cn('flex overflow-hidden', image ? 'flex-row' : 'flex-col')}>
        {image && (
          <div className="hidden md:block w-2/5 shrink-0">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-8 flex-1">
          <button onClick={handleClose} className="absolute top-3 end-3 text-gray-400 hover:text-gray-600 text-xl">&times;</button>

          {status === 'success' ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">&#127881;</div>
              <h3 className="text-xl font-bold mb-1">{t('newsletter.success_title')}</h3>
              <p className="text-gray-500 text-sm">{t('newsletter.success')}</p>
            </div>
          ) : (
            <>
              <h3 className="text-2xl font-bold mb-2">{title ?? t('newsletter.title')}</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">{description ?? t('newsletter.description')}</p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('newsletter.placeholder')}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="w-full py-3 rounded-lg text-white font-medium transition disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary, #2563eb)' }}
                >
                  {status === 'loading' ? t('newsletter.subscribing') : t('newsletter.submit')}
                </button>
                {status === 'error' && (
                  <p className="text-red-500 text-xs text-center">{t('newsletter.error')}</p>
                )}
              </form>

              <button onClick={handleClose} className="w-full text-center text-xs text-gray-400 mt-4 hover:text-gray-600">
                {t('newsletter.no_thanks')}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
