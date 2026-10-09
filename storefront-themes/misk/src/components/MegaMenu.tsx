import React from 'react';
import { Link } from 'react-router-dom';
import type { MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { I } from '../lib/icons';

export const itemHref = (item: MenuItem) => item.resolvedUrl || item.url || '/';
export const isExternal = (item: MenuItem) => item.type === 'external' || item.target === '_blank';

export const MenuLink: React.FC<{ item: MenuItem; className?: string; onClick?: () => void; children?: React.ReactNode }> = ({ item, className, onClick, children }) =>
  isExternal(item) ? (
    <a href={itemHref(item)} target={item.target || '_blank'} rel="noopener noreferrer" className={className} onClick={onClick}>{children ?? item.label}</a>
  ) : (
    <Link to={itemHref(item)} className={className} onClick={onClick}>{children ?? item.label}</Link>
  );

export interface MegaPromo {
  show?: boolean;
  image?: string;
  eyebrow?: string;
  title?: string;
  ctaText?: string;
  ctaUrl?: string;
}

/**
 * Full-width white panel under a top-level nav item: link columns first, then
 * an optional promo card at the end. Children without their own children
 * render as one "Browse" column so a flat sub-menu still looks deliberate.
 *
 * Layout is grid-based with logical properties only, so the promo lands on the
 * correct side under RTL without a mirrored copy of the markup.
 */
export const MegaMenu: React.FC<{ item: MenuItem; promo: MegaPromo; onNavigate: () => void; browseLabel: string }> = ({ item, promo, onNavigate, browseLabel }) => {
  const kids = item.children || [];
  const groups = kids.some((k) => k.children?.length) ? kids.slice(0, 4) : [{ label: browseLabel, children: kids } as MenuItem];
  const showPromo = promo.show !== false && (promo.image || promo.title);
  const linkCls = 'block py-1.5 text-sm text-ink transition-colors duration-300 hover:text-gold-ink';

  return (
    <div className="border-t border-line bg-white shadow-[var(--shadow-lg)]">
      <div className={`mx-auto grid max-w-[1320px] gap-10 px-6 py-9 ${showPromo ? 'grid-cols-[minmax(0,1fr)_minmax(0,320px)]' : 'grid-cols-1'}`}>
        <div className={`grid gap-8 ${groups.length >= 3 ? 'grid-cols-3' : groups.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {groups.map((g, gi) => (
            <div key={g._id || gi}>
              {g.children?.length ? (
                <>
                  <MenuLink item={g} onClick={onNavigate} className="misk-eyebrow mb-4 block text-gold-ink hover:text-ink">{g.label}</MenuLink>
                  <ul className="space-y-0.5">
                    {g.children.slice(0, 10).map((c, ci) => (
                      <li key={c._id || ci}><MenuLink item={c} onClick={onNavigate} className={linkCls} /></li>
                    ))}
                  </ul>
                </>
              ) : (
                <MenuLink item={g} onClick={onNavigate} className={linkCls} />
              )}
            </div>
          ))}
        </div>

        {showPromo && (
          <div className="group relative overflow-hidden rounded-[var(--radius-lg,18px)] bg-sand">
            {promo.image && (
              <span className="misk-zoom absolute inset-0 block overflow-hidden">
                <img src={promo.image} alt="" loading="lazy" className="h-full w-full object-cover" />
              </span>
            )}
            <div className="relative flex min-h-[260px] flex-col justify-end gap-2 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-6">
              {promo.eyebrow && <p className="misk-eyebrow text-white/85">{promo.eyebrow}</p>}
              {promo.title && <p className="font-display text-2xl leading-snug text-white">{promo.title}</p>}
              {promo.ctaText && (
                <Link to={promo.ctaUrl || '/products'} onClick={onNavigate} className="misk-btn misk-btn-light mt-3 self-start">
                  {promo.ctaText} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MegaMenu;
