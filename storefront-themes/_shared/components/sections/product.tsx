import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeSettings } from '../../theme/ThemeProvider';
import { useProductContext } from '../../contexts/ProductContext';
import { useStore } from '../../contexts/StoreContext';
import type { SectionComponentProps } from './index';

/**
 * PDP, data-driven sections (Layer 1 + 2).
 *
 * These are merchant-composable sections for the `product` template that
 * render the CURRENT product's / store's REAL data — so a product page shows
 * genuine per-product content instead of the hardcoded "default stuff" each
 * theme used to ship. They pick up theme colors/fonts via CSS vars, and each
 * returns null when there's nothing to show (or when placed off a PDP), so
 * they never render an empty shell.
 */

const wrap = (settings: Record<string, any>): React.CSSProperties => ({
  paddingTop: settings.padding_top != null ? `${settings.padding_top}px` : undefined,
  paddingBottom: settings.padding_bottom != null ? `${settings.padding_bottom}px` : undefined,
});

// ─── Product details: description + specifications ───────────────
export const ProductDetailsSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('product');
  const s = useThemeSettings(id);
  const ctx = useProductContext();
  const product = ctx?.product;

  const showDescription = s.show_description !== false;
  const showSpecs = s.show_specs !== false;

  const description: string = product?.description || '';
  const specs: Array<{ key?: string; name?: string; label?: string; value?: string }> =
    Array.isArray(product?.specifications) ? product.specifications : [];

  if (!product) return null;
  const hasDescription = showDescription && !!description.trim();
  const hasSpecs = showSpecs && specs.length > 0;
  if (!hasDescription && !hasSpecs) return null;

  const heading = s.heading || t('detail.details_heading', { defaultValue: 'Details' });
  // Description may be sanitised HTML or plain text; render HTML but only the
  // server-sanitised field is ever placed here.
  const looksHtml = /<[a-z][\s\S]*>/i.test(description);

  return (
    <section
      className="max-w-4xl mx-auto px-4 py-10"
      style={{ ...wrap(s), color: 'var(--color-foreground)' }}
    >
      {heading && (
        <h2
          className="text-xl md:text-2xl font-bold mb-5"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {heading}
        </h2>
      )}

      {hasDescription && (
        looksHtml ? (
          <div
            className="prose max-w-none leading-relaxed"
            style={{ color: 'var(--color-foreground)' }}
            dangerouslySetInnerHTML={{ __html: description }}
          />
        ) : (
          <p className="leading-relaxed whitespace-pre-line" style={{ opacity: 0.9 }}>
            {description}
          </p>
        )
      )}

      {hasSpecs && (
        <div className={hasDescription ? 'mt-8' : ''}>
          {s.specs_heading !== '' && (
            <h3 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ opacity: 0.7 }}>
              {s.specs_heading || t('detail.specs_heading', { defaultValue: 'Specifications' })}
            </h3>
          )}
          <dl className="divide-y" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
            {specs.map((row, i) => {
              const label = row.key || row.name || row.label || '';
              if (!label && !row.value) return null;
              return (
                <div key={i} className="grid grid-cols-3 gap-4 py-2.5 text-sm">
                  <dt className="font-medium" style={{ opacity: 0.7 }}>{label}</dt>
                  <dd className="col-span-2">{row.value}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}
    </section>
  );
};

// ─── Store policies: shipping / returns / COD accordion ──────────
export const ProductPoliciesSection: React.FC<SectionComponentProps> = ({ id }) => {
  const { t } = useTranslation('product');
  const s = useThemeSettings(id);
  const { store } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  const policies = store?.policies || {};
  const entries = Object.entries(policies).filter(
    ([, p]: any) => p && p.body && String(p.body).trim()
  );
  if (entries.length === 0) return null;

  const heading = s.heading || t('detail.policies_heading', { defaultValue: 'Shipping & Returns' });

  return (
    <section
      className="max-w-4xl mx-auto px-4 py-10"
      style={{ ...wrap(s), color: 'var(--color-foreground)' }}
    >
      {heading && (
        <h2
          className="text-xl md:text-2xl font-bold mb-5"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {heading}
        </h2>
      )}
      <div className="border-t" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
        {entries.map(([key, p]: any) => {
          const isOpen = open === key;
          const title = p.title || t(`policy.${key}`, { defaultValue: key });
          return (
            <div key={key} className="border-b" style={{ borderColor: 'var(--color-border, #e5e7eb)' }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 py-4 text-start"
              >
                <span className="font-medium">{title}</span>
                <svg
                  className={`w-4 h-4 flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isOpen && (
                <div
                  className="prose max-w-none pb-5 text-sm leading-relaxed"
                  style={{ color: 'var(--color-foreground)', opacity: 0.9 }}
                  dangerouslySetInnerHTML={{ __html: p.body }}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
