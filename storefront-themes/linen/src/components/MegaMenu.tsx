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
  image?: string;
  eyebrow?: string;
  title?: string;
  ctaText?: string;
  ctaUrl?: string;
}

/**
 * Full-width cream panel under a top-level nav item: promo image at the
 * start, up to four link columns in the centre (one per child group), a
 * promo card at the end. Children without their own children render as a
 * single "Browse" column so a flat sub-menu still looks intentional.
 */
export const MegaMenu: React.FC<{ item: MenuItem; promo: MegaPromo; onNavigate: () => void; browseLabel: string }> = ({ item, promo, onNavigate, browseLabel }) => {
  const kids = item.children || [];
  const groups = kids.some((k) => k.children?.length)
    ? kids.slice(0, 4)
    : [{ label: browseLabel, children: kids } as MenuItem];
  const linkCls = 'block py-1.5 text-[0.95rem] text-ink transition-colors duration-300 hover:text-clay';
  return (
    <div className="border-t border-line bg-cream shadow-[0_24px_40px_-24px_rgba(15,15,15,0.25)]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,240px)_minmax(0,1fr)_minmax(0,260px)] gap-10 px-6 py-8">
        <div className="aspect-[4/5] overflow-hidden bg-sand">
          {promo.image && <img src={promo.image} alt="" className="h-full w-full object-cover" loading="lazy" />}
        </div>
        <div className={`grid gap-8 ${groups.length >= 3 ? 'grid-cols-3' : groups.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {groups.map((g, gi) => (
            <div key={g._id || gi}>
              {g.children?.length ? (
                <>
                  <MenuLink item={g} onClick={onNavigate} className="linen-eyebrow mb-4 block text-ink hover:text-clay">{g.label}</MenuLink>
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
        <div className="flex flex-col justify-between border-s border-line ps-8">
          <div>
            {promo.eyebrow && <p className="linen-eyebrow text-clay">{promo.eyebrow}</p>}
            {promo.title && <p className="font-heading mt-3 text-2xl leading-snug text-ink">{promo.title}</p>}
          </div>
          {promo.ctaText && (
            <Link to={promo.ctaUrl || '/products'} onClick={onNavigate} className="linen-btn linen-btn-outline mt-6 self-start">
              {promo.ctaText} <I.arrowRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default MegaMenu;
