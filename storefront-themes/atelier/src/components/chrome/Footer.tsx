import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useMenu, type MenuItem } from '@matjar/theme-shared/hooks/useMenu';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { useSectionBlocks, useTemplateSections } from '@matjar/theme-shared/theme/ThemeProvider';
import { Icon } from '../../lib/motion';

const SOCIAL_PATHS: Record<string, string> = {
  facebook: 'M14 8h3V4h-3a4 4 0 00-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z',
  instagram: 'M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zm5 5a4 4 0 100 8 4 4 0 000-8zm5-1h.01',
  twitter: 'M4 4l16 16M20 4L4 20',
  x: 'M4 4l16 16M20 4L4 20',
  tiktok: 'M14 3v10a3 3 0 11-3-3M14 3a4 4 0 004 4',
  whatsapp: 'M4 20l1.5-4A8 8 0 1112 20a8 8 0 01-4-1zM9 9c0 4 2 6 6 6',
  youtube: 'M3 8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2zM10 9l5 3-5 3z',
  snapchat: 'M12 3a5 5 0 015 5v3c2 0 2 1 0 2 1 2 3 3 4 3-1 2-3 2-4 3-1 1-3 2-5 2s-4-1-5-2c-1-1-3-1-4-3 1 0 3-1 4-3-2-1-2-2 0-2V8a5 5 0 015-5z',
};

export const SocialIcons: React.FC<{ className?: string; light?: boolean }> = ({ className = '', light }) => {
  const { store } = useStore();
  const links = Object.entries(store?.socialLinks || {}).filter(([, v]) => !!v);
  if (!links.length) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {links.map(([k, v]) => (
        <li key={k}>
          <a href={v} target="_blank" rel="noopener noreferrer" aria-label={k} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors duration-300 ${light ? 'border-white/25 text-white hover:bg-white hover:text-[#1c1c1c]' : 'border-[#e5e5e5] text-[#1c1c1c] hover:bg-[#1c1c1c] hover:text-white'}`}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={SOCIAL_PATHS[k.toLowerCase()] || SOCIAL_PATHS.instagram} /></svg>
          </a>
        </li>
      ))}
    </ul>
  );
};

/** Four icon promises; used as a home section and above the footer sitewide. */
export const UspStrip: React.FC<{ items: { icon: string; title: string; text: string }[]; className?: string; style?: React.CSSProperties }> = ({ items, className = '', style }) => (
  <div className={`mx-auto grid max-w-[1320px] grid-cols-1 gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 ${className}`} style={style}>
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-4">
        <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--atelier-bronze-ink)] shadow-[0_2px_10px_#0000001a] xl:h-[85px] xl:w-[85px]"><Icon name={it.icon} className="h-7 w-7" /></span>
        <div><p className="text-[15px] font-extrabold">{it.title}</p><p className="text-[13px] text-[#4a4a4a]">{it.text}</p></div>
      </div>
    ))}
  </div>
);

const Col: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 py-3 md:border-0 md:py-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between text-[12px] font-extrabold uppercase tracking-[0.16em] text-white md:pointer-events-none md:pb-4">
        {title}
        <svg className={`h-4 w-4 transition-transform duration-300 md:hidden ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className={`${open ? 'block pt-3' : 'hidden'} md:block`}>{children}</div>
    </div>
  );
};

const Footer: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const { items: footerMenu } = useMenu('footer');
  const { categories } = useCategories();
  const phone = store?.contact?.phone || store?.contactInfo?.phone;
  const email = store?.contact?.email || store?.contactInfo?.email;
  const address = store?.contact?.address || store?.contactInfo?.address;
  const hours = store?.contactInfo?.hours;
  const links: MenuItem[] = footerMenu.length ? footerMenu : [{ label: t('theme.layout.nav.shop'), url: '/products' }, ...categories.slice(0, 5).map((c: any) => ({ label: c.name, url: `/categories/${c.slug}` }))];
  // Sitewide USP strip: mirrors the home "usp" section's blocks when present.
  const home = useTemplateSections('index');
  const usp = home.find((s) => s.type === 'atelier-usp-strip');
  const uspBlocks = useSectionBlocks(usp?.id || '__none__');
  const uspItems = uspBlocks.map((b) => ({ icon: b.settings.icon || 'check', title: b.settings.title, text: b.settings.text })).filter((b) => b.title);
  const linkCls = 'text-[14px] text-white/75 transition-colors duration-300 hover:text-[color:var(--atelier-bronze-light)]';

  return (
    <footer className="mt-10">
      {uspItems.length > 0 && (
        <div className="border-t border-[#e5e5e5] bg-[color:var(--color-accent)] py-8"><UspStrip items={uspItems} /></div>
      )}
      <div className="bg-[#1c1c1c] text-white">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-4 py-14 sm:px-6 md:grid-cols-12">
          <div className="md:col-span-4">
            <Link to="/" className="inline-block">
              {store?.logo ? <img src={store.logo} alt={store.name} className="h-9 w-auto brightness-0 invert" /> : <span className="font-display text-3xl">{store?.name}</span>}
            </Link>
            {store?.description && <p className="mt-4 max-w-sm text-[14px] text-white/70">{store.description}</p>}
            <ul className="mt-5 space-y-2 text-[14px] text-white/85">
              {address && <li className="flex gap-3"><Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--atelier-bronze)]" /><span>{address}</span></li>}
              {phone && <li className="flex gap-3"><Icon name="headset" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--atelier-bronze)]" /><a href={`tel:${phone}`} dir="ltr" className="at-link-hover-light">{phone}</a></li>}
              {email && <li className="flex gap-3"><Icon name="sparkle" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--atelier-bronze)]" /><a href={`mailto:${email}`} className="at-link-hover-light">{email}</a></li>}
              {hours && <li className="flex gap-3"><Icon name="sun" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--atelier-bronze)]" /><span>{hours}</span></li>}
            </ul>
            <SocialIcons className="mt-6" light />
          </div>
          <div className="md:col-span-3">
            <Col title={t('theme.footer.shop')}>
              <ul className="space-y-2">{links.map((l) => <li key={l._id || l.label}><Link to={l.resolvedUrl || l.url || '/'} className={linkCls}>{l.label}</Link></li>)}</ul>
            </Col>
          </div>
          <div className="md:col-span-2">
            <Col title={t('theme.footer.policies')}>
              <PolicyLinks heading={false} className="space-y-2" linkClassName={linkCls} />
            </Col>
          </div>
          <div className="md:col-span-3">
            <Col title={t('theme.footer.help')}>
              <ul className="space-y-2">
                <li><Link to="/contact" className={linkCls}>{t('theme.footer.contact')}</Link></li>
                <li><Link to="/orders" className={linkCls}>{t('theme.footer.track')}</Link></li>
                <li><Link to="/account" className={linkCls}>{t('theme.footer.account')}</Link></li>
                <li><Link to="/wishlist" className={linkCls}>{t('theme.layout.wishlist')}</Link></li>
              </ul>
            </Col>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-4 px-4 py-5 text-[12px] text-white/60 sm:px-6 md:flex-row">
            <p>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || '' })}</p>
            <FooterPaymentBadges size="sm" className="opacity-90" />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
