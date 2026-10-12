import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shown on the homepage in place of the product sections while the store has
 * no products (theme/homeSections.ts). Plain and calm, in each theme's own
 * colours and fonts through the CSS-var tokens.
 */
export const NoProductsYet: React.FC = () => {
  const { t } = useTranslation('common');
  return (
    <section className="px-4 py-16 sm:py-24" data-home-empty="">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <span
          className="grid h-16 w-16 place-items-center rounded-full"
          style={{
            backgroundColor: 'var(--brand-soft, color-mix(in srgb, var(--color-foreground) 6%, transparent))',
            color: 'var(--brand-ink, var(--color-muted, var(--color-foreground)))',
          }}
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 7h12l-1 13H7L6 7Z" />
            <path d="M9 7V6a3 3 0 0 1 6 0v1" />
          </svg>
        </span>
        <p
          className="text-lg font-semibold leading-normal"
          style={{ color: 'var(--color-foreground)', fontFamily: 'var(--font-family-heading, inherit)' }}
        >
          {t('home.no_products')}
        </p>
      </div>
    </section>
  );
};

export default NoProductsYet;
