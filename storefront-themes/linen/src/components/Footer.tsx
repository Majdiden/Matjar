import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useMenu } from '@matjar/theme-shared/hooks/useMenu';
import { useCategories } from '@matjar/theme-shared/hooks/useProducts';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { I } from '../lib/icons';
import { MenuLink } from './MegaMenu';

/**
 * Four columns: about + newsletter · shop (footer menu, else categories) ·
 * policies · contact/hours. Social icons, payment badges and copyright below.
 */
export const Footer: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const { items: footerItems } = useMenu('footer');
  const { categories } = useCategories();
  const aboutSetting = useThemeSetting<string>('footer_about');
  const hoursSetting = useThemeSetting<string>('opening_hours');
  // Merchant copy wins; the theme's translations carry the demo defaults.
  const about = (aboutSetting && aboutSetting.trim()) || t('theme.footer.about', { defaultValue: '' });
  const hours = (hoursSetting && hoursSetting.trim()) || t('theme.footer.hours', { defaultValue: '' });
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const social = Object.entries(store?.socialLinks || {}).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]);
  const linkCls = 'block py-1 text-[0.95rem] text-dune transition-colors duration-300 hover:text-clay';

  return (
    <footer className="mt-16 border-t border-line bg-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link to="/" className="font-heading text-2xl tracking-[0.2em] text-ink">{store?.name?.toUpperCase() || 'STORE'}</Link>
            {about && <p className="mt-4 max-w-sm text-[0.95rem] text-dune">{about}</p>}
            <form
              className="mt-6"
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) setDone(true); }}
              aria-label={t('theme.footer.newsletter_heading')}
            >
              <p className="linen-eyebrow mb-3 text-ink">{t('theme.footer.newsletter_heading')}</p>
              {done ? (
                <p className="flex items-center gap-2 text-sm text-[color:var(--color-success)]"><I.check className="h-4 w-4" /> {t('theme.footer.newsletter_done')}</p>
              ) : (
                <div className="flex max-w-sm">
                  <label className="sr-only" htmlFor="linen-news">{t('theme.footer.newsletter_placeholder')}</label>
                  <input id="linen-news" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('theme.footer.newsletter_placeholder')} className="h-12 min-w-0 flex-1 border border-line bg-white/70 px-4 text-base text-ink outline-none focus:border-bronze" />
                  <button type="submit" className="linen-btn linen-btn-dark h-12 px-5">{t('theme.footer.newsletter_button')}</button>
                </div>
              )}
            </form>
          </div>

          <div>
            <p className="linen-eyebrow mb-4 text-ink">{t('theme.footer.shop')}</p>
            <ul>
              <li><Link to="/products" className={linkCls}>{t('theme.nav.all_products')}</Link></li>
              {(footerItems.length ? footerItems : []).slice(0, 6).map((it, i) => <li key={it._id || i}><MenuLink item={it} className={linkCls} /></li>)}
              {!footerItems.length && categories.slice(0, 5).map((c) => <li key={c._id}><Link to={`/categories/${c.slug}`} className={linkCls}>{c.name}</Link></li>)}
            </ul>
          </div>

          <div>
            <p className="linen-eyebrow mb-4 text-ink">{t('theme.footer.help')}</p>
            <ul>
              <li><Link to="/contact" className={linkCls}>{t('theme.nav.contact')}</Link></li>
              <li><Link to="/track-order" className={linkCls}>{t('theme.nav.track_order')}</Link></li>
              <li><Link to="/account" className={linkCls}>{t('theme.nav.account')}</Link></li>
            </ul>
            <PolicyLinks className="mt-2 [&_a]:block [&_a]:py-1 [&_a]:text-[0.95rem]" linkClassName="text-dune transition-colors hover:text-clay" />
          </div>

          <div className="text-[0.95rem] text-dune">
            <p className="linen-eyebrow mb-4 text-ink">{t('theme.footer.contact')}</p>
            {store?.contact?.address && <p className="mb-2">{store.contact.address}</p>}
            {store?.contact?.phone && <a href={`tel:${store.contact.phone}`} className="block hover:text-clay" dir="ltr">{store.contact.phone}</a>}
            {store?.contact?.email && <a href={`mailto:${store.contact.email}`} className="block hover:text-clay" dir="ltr">{store.contact.email}</a>}
            {hours && <p className="mt-3">{hours}</p>}
            {social.length > 0 && (
              <div className="mt-5 flex gap-2">
                {social.map(([k, url]) => {
                  const Icon = (I as any)[k] || I.share;
                  return <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={k} className="grid h-10 w-10 place-items-center border border-line text-ink transition-colors hover:border-bronze hover:bg-bronze hover:text-cream"><Icon className="h-4 w-4" /></a>;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-sm text-dune md:flex-row md:items-center md:justify-between">
          <p>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || '' })}</p>
          <FooterPaymentBadges />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
