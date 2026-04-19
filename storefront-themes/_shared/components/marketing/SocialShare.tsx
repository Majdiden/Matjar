import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { useThemeSlot } from '../../theme/ThemeSlotsProvider';

export const SLOT_KEY = 'socialShare';

interface SocialShareProps {
  url: string;
  title: string;
  description?: string;
  className?: string;
  platforms?: Array<'facebook' | 'twitter' | 'pinterest' | 'whatsapp' | 'email' | 'copy'>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icons' | 'buttons';
}

const sizeClasses = { sm: 'w-7 h-7', md: 'w-9 h-9', lg: 'w-11 h-11' };
const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' };

export function SocialShare(props: SocialShareProps) {
  const Override = useThemeSlot<React.ComponentType<SocialShareProps>>(SLOT_KEY);
  if (Override) return <Override {...props} />;
  const { t } = useTranslation('marketing');
  const {
    url,
    title,
    description,
    className,
    platforms = ['facebook', 'twitter', 'pinterest', 'whatsapp', 'copy'],
    size = 'md',
    variant = 'icons',
  } = props;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDesc = encodeURIComponent(description || title);

  const links: Record<string, { href: string; label: string; color: string; icon: React.ReactNode }> = {
    facebook: {
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      label: 'Facebook',
      color: '#1877F2',
      icon: <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />,
    },
    twitter: {
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      label: 'Twitter',
      color: '#1DA1F2',
      icon: <path d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z" />,
    },
    pinterest: {
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedDesc}`,
      label: 'Pinterest',
      color: '#E60023',
      icon: <path d="M12 0C5.373 0 0 5.373 0 12c0 4.99 3.657 9.128 8.438 9.879-.117-.91-.223-2.31.047-3.304.243-.898 1.57-6.66 1.57-6.66s-.4-.803-.4-1.99c0-1.864 1.08-3.256 2.425-3.256 1.144 0 1.696.858 1.696 1.888 0 1.15-.732 2.87-1.11 4.466-.315 1.335.67 2.424 1.988 2.424 2.385 0 4.22-2.514 4.22-6.142 0-3.213-2.308-5.46-5.603-5.46-3.816 0-6.057 2.862-6.057 5.822 0 1.153.444 2.39.999 3.062a.4.4 0 01.092.384c-.102.424-.328 1.335-.373 1.522-.058.247-.193.3-.447.18C5.566 14.168 4.29 11.588 4.29 9.607c0-4.146 3.012-7.953 8.683-7.953 4.56 0 8.106 3.25 8.106 7.59 0 4.53-2.855 8.175-6.82 8.175-1.333 0-2.586-.692-3.015-1.51 0 0-.66 2.51-.82 3.126-.297 1.142-1.098 2.573-1.634 3.447A12 12 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />,
    },
    whatsapp: {
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      label: 'WhatsApp',
      color: '#25D366',
      icon: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />,
    },
    email: {
      href: `mailto:?subject=${encodedTitle}&body=${encodedDesc}%20${encodedUrl}`,
      label: 'Email',
      color: '#6B7280',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    },
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {}
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {platforms.map(platform => {
        if (platform === 'copy') {
          return (
            <button
              key="copy"
              onClick={handleCopy}
              className={cn(
                sizeClasses[size],
                'flex items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition'
              )}
              title={t('social_share.copy_link')}
            >
              <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          );
        }

        const item = links[platform];
        if (!item) return null;

        return (
          <a
            key={platform}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              sizeClasses[size],
              'flex items-center justify-center rounded-full transition hover:opacity-80'
            )}
            style={{ backgroundColor: item.color, color: 'white' }}
            title={t(`social_share.aria.${platform}`)}
          >
            <svg className={iconSizes[size]} viewBox="0 0 24 24" fill="currentColor">
              {item.icon}
            </svg>
          </a>
        );
      })}
    </div>
  );
}
