import React from 'react';
import { FG, MUTED, PRIMARY_COLOR, PRIMARY_INK, HEADING_FONT, tint, useOnPrimary, usePageStyleTokens } from '../../theme/pageStyle';
import { PageIcon, type PageIconName } from './PageIcon';

interface PageHeroProps {
  title: string;
  /** Small line above the title — usually the store name. */
  eyebrow?: string | null;
  /** Line under the title — tagline or a short description. */
  subtitle?: string | null;
  /** Cover photo; without one the hero is a block in the theme's primary colour. */
  image?: string | null;
  /** Compact header band (policies) with an icon instead of a photo. */
  compact?: boolean;
  icon?: PageIconName;
}

/** Darkens the photo enough for white text without hiding it. */
const PHOTO_OVERLAY =
  'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.18) 100%)';
const PHOTO_OVERLAY_CENTER = 'linear-gradient(rgba(0,0,0,0.42), rgba(0,0,0,0.58))';

/**
 * Top of every generated page: the store's cover photo with the page title
 * over it, or — with no photo — a calm block in the theme's colours.
 * Heights are fixed per breakpoint so the photo never shifts the layout.
 */
export const PageHero: React.FC<PageHeroProps> = ({ title, eyebrow, subtitle, image, compact = false, icon }) => {
  const tk = usePageStyleTokens();
  const onPrimary = useOnPrimary();
  const { style } = tk;
  const centered = style === 'editorial' || (!image && !compact && style === 'bold');
  // Bold heroes sit as a rounded card inside the page; the others run edge to edge.
  const frame = style === 'bold' ? 'mx-3 sm:mx-6 mt-3 sm:mt-6 overflow-hidden' : '';
  const frameStyle: React.CSSProperties = style === 'bold' ? { borderRadius: tk.radius } : {};

  const eyebrowEl = (color: string) =>
    eyebrow ? (
      <p className={`${tk.eyebrowClass} mb-3 ${style === 'editorial' ? 'flex items-center justify-center gap-3' : ''}`} style={{ color }}>
        {style === 'editorial' && <span aria-hidden="true" className="h-px w-6 bg-current opacity-60" />}
        <span>{eyebrow}</span>
        {style === 'editorial' && <span aria-hidden="true" className="h-px w-6 bg-current opacity-60" />}
      </p>
    ) : null;

  const titleClass = compact ? tk.titleClass.replace(/text-\S+ sm:text-\S+/, 'text-3xl sm:text-4xl') : tk.titleClass;

  if (image && !compact) {
    return (
      <section className={`relative isolate ${frame}`} style={frameStyle}>
        <img
          src={image}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          loading="eager"
          decoding="async"
          // React 18 doesn't know fetchPriority yet; the lowercase DOM attribute works everywhere.
          {...({ fetchpriority: 'high' } as Record<string, string>)}
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ background: centered ? PHOTO_OVERLAY_CENTER : PHOTO_OVERLAY }} />
        <div
          className={`max-w-5xl mx-auto px-5 sm:px-8 flex flex-col min-h-[22rem] sm:min-h-[28rem] ${
            centered ? 'justify-center items-center text-center py-16' : 'justify-end pt-24 pb-8 sm:pb-12'
          }`}
          style={{ color: '#ffffff' }}
        >
          {eyebrowEl('rgba(255,255,255,0.88)')}
          <h1 className={`${titleClass} leading-[1.1] [text-wrap:balance]`} style={{ ...tk.heading, color: '#ffffff' }}>
            {title}
          </h1>
          {subtitle && (
            <p className={`mt-3 text-base sm:text-lg max-w-xl leading-relaxed ${centered ? 'mx-auto' : ''}`} style={{ color: 'rgba(255,255,255,0.9)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </section>
    );
  }

  // No photo (or the compact band): solid primary for bold, a soft tint otherwise.
  const solid = style === 'bold';
  const textColor = solid ? onPrimary : FG;
  const subColor = solid ? onPrimary : MUTED;
  const background = solid ? PRIMARY_COLOR : style === 'editorial' ? tint(5) : tint(7);

  return (
    <section
      className={`relative isolate overflow-hidden ${frame}`}
      style={{
        ...frameStyle,
        background,
        borderBottom: style === 'clean' ? `1px solid ${tint(14)}` : undefined,
      }}
    >
      {solid && (
        <>
          <span aria-hidden="true" className="absolute -top-16 -end-12 h-48 w-48 rounded-full -z-10" style={{ background: textColor, opacity: 0.1 }} />
          <span aria-hidden="true" className="absolute -bottom-20 -start-10 h-40 w-40 rounded-full -z-10" style={{ background: textColor, opacity: 0.08 }} />
        </>
      )}
      <div
        className={`max-w-5xl mx-auto px-5 sm:px-8 ${compact ? 'py-8 sm:py-10' : 'py-14 sm:py-20'} ${
          centered ? 'text-center flex flex-col items-center' : ''
        }`}
        style={{ color: textColor }}
      >
        {compact && icon && (
          <span
            className={`inline-flex items-center justify-center mb-4 ${style === 'editorial' ? 'h-10 w-10' : 'h-12 w-12'}`}
            style={
              solid
                ? { background: textColor === '#ffffff' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)', borderRadius: 'var(--radius-pill, 9999px)', color: textColor }
                : { ...tk.iconBox, ...(style === 'editorial' ? { border: `1px solid ${tint(30)}`, borderRadius: 'var(--radius-pill, 9999px)' } : {}) }
            }
          >
            <PageIcon name={icon} className={style === 'bold' ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={style === 'bold' ? 2 : 1.6} />
          </span>
        )}
        {eyebrowEl(solid ? textColor : style === 'editorial' ? MUTED : PRIMARY_INK)}
        <h1
          className={`${titleClass} leading-[1.1] [text-wrap:balance]`}
          style={{ ...tk.heading, fontFamily: HEADING_FONT, color: textColor }}
        >
          {title}
        </h1>
        {style === 'editorial' && !compact && (
          <span aria-hidden="true" className="block h-px w-12 mt-6" style={{ background: textColor, opacity: 0.4 }} />
        )}
        {subtitle && (
          <p
            className={`${style === 'editorial' && !compact ? 'mt-5' : 'mt-3'} text-base sm:text-lg max-w-xl leading-relaxed`}
            style={{ color: subColor, opacity: solid ? 0.9 : 1 }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
};

export default PageHero;
