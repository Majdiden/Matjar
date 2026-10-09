import React from 'react';
import { useTranslation } from 'react-i18next';
import { useContactInfo } from '../../hooks/useContactInfo';
import { FG, BORDER, MUTED, tint, usePageStyleTokens } from '../../theme/pageStyle';
import { SocialIcon } from './PageIcon';

/** The store's social pages as a row of buttons; nothing when none are set. */
export const SocialLinks: React.FC<{ className?: string; heading?: string | false }> = ({ className = '', heading }) => {
  const { t } = useTranslation('generated');
  const { socialLinks } = useContactInfo();
  const tk = usePageStyleTokens();
  if (!socialLinks.length) return null;
  const title = heading === false ? null : heading || t('contact.follow');

  return (
    <div className={`text-center ${className}`}>
      {title && (
        <p className={`${tk.eyebrowClass} mb-3`} style={{ color: MUTED }}>
          {title}
        </p>
      )}
      <ul className="flex flex-wrap justify-center gap-2">
        {socialLinks.map((s) => (
          <li key={s.platform}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition hover:opacity-80"
              style={{
                color: FG,
                borderRadius: 'var(--radius-pill, 9999px)',
                ...(tk.style === 'bold' ? { background: tint(10) } : { border: `1px solid ${BORDER}` }),
              }}
            >
              <SocialIcon platform={s.platform} className="w-4 h-4" />
              <span>{s.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SocialLinks;
