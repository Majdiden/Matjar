import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@matjar/theme-shared/contexts/StoreContext';
import { useMenu } from '@matjar/theme-shared/hooks/useMenu';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { PolicyLinks } from '@matjar/theme-shared/components/PolicyLinks';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { MenuLink } from './MegaMenu';
import { I } from '../lib/icons';

/**
 * Four panels divided by hairlines: contact · shop links · wordmark and social
 * · a WhatsApp block. The reference theme puts a newsletter signup in the last
 * panel; newsletters were removed platform-wide, and for this audience a
 * WhatsApp hand-off converts far better anyway.
 *
 * Every panel is individually switchable from the customizer, and the grid
 * collapses to one column per panel on phones rather than squeezing four.
 */
export const Footer: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const { store } = useStore();
  const { items: menuItems } = useMenu('footer');

  const showContact = useThemeSetting<boolean>('footer_show_contact') !== false;
  const showMenu = useThemeSetting<boolean>('footer_show_menu') !== false;
  const showSocial = useThemeSetting<boolean>('footer_show_social') !== false;
  const showPayment = useThemeSetting<boolean>('footer_show_payment') !== false;
  const showWhats = useThemeSetting<boolean>('show_whatsapp_block') !== false;
  const background = useThemeSetting<string>('footer_background');
  const aboutText = (useThemeSetting<string>('footer_about') || '').trim() || t('theme.footer.about');

  const waNumber = (useThemeSetting<string>('whatsapp_number') || '').replace(/[^\d]/g, '');
  const waHeading = (useThemeSetting<string>('whatsapp_heading') || '').trim() || t('theme.whatsapp.heading');
  const waText = (useThemeSetting<string>('whatsapp_text') || '').trim() || t('theme.whatsapp.text');

  // The API returns both shapes depending on where the merchant filled it in.
  const contact: any = (store as any)?.contact || (store as any)?.contactInfo || null;
  const social = Object.entries(store?.socialLinks || {}).filter((e): e is [string, string] => typeof e[1] === 'string' && !!e[1]);

  const linkCls = 'block py-1.5 text-sm text-muted transition-colors duration-300 hover:text-ink';
  const panel = 'px-6 py-10 lg:px-10';

  return (
    <footer className="misk-footer border-t border-line" style={background ? { background } : undefined}>
      <div className="mx-auto grid max-w-[1320px] divide-y divide-line lg:grid-cols-4 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
        {showContact && (
          <div className={panel}>
            <p className="misk-eyebrow mb-5 text-ink">{t('theme.footer.contact')}</p>
            <div className="space-y-2 text-sm text-muted">
              {contact?.address && <p className="flex items-start gap-2"><I.pin className="mt-0.5 h-4 w-4 shrink-0" />{contact.address}</p>}
              {contact?.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 transition-colors hover:text-ink">
                  <I.phone className="h-4 w-4 shrink-0" /><span dir="ltr">{contact.phone}</span>
                </a>
              )}
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 transition-colors hover:text-ink">
                  <I.mail className="h-4 w-4 shrink-0" /><span dir="ltr">{contact.email}</span>
                </a>
              )}
              <p className="pt-2">{t('theme.footer.hours')}</p>
            </div>
          </div>
        )}

        {showMenu && (
          <div className={panel}>
            <p className="misk-eyebrow mb-5 text-ink">{t('theme.footer.shop')}</p>
            <ul>
              {menuItems.length ? (
                menuItems.slice(0, 7).map((it, i) => <li key={it._id || i}><MenuLink item={it} className={linkCls} /></li>)
              ) : (
                <>
                  <li><Link to="/products" className={linkCls}>{t('theme.nav.all_products')}</Link></li>
                  <li><Link to="/collections" className={linkCls}>{t('theme.scent_cards.eyebrow')}</Link></li>
                  <li><Link to="/pages/about" className={linkCls}>{t('theme.concept.cta')}</Link></li>
                  <li><Link to="/contact" className={linkCls}>{t('theme.nav.contact')}</Link></li>
                  <li><Link to="/wishlist" className={linkCls}>{t('theme.nav.wishlist')}</Link></li>
                  <li><Link to="/account" className={linkCls}>{t('theme.nav.account')}</Link></li>
                </>
              )}
              {/* Policies resolve to the merchant's own configured policy pages. */}
              <li><PolicyLinks className={linkCls} /></li>
            </ul>
          </div>
        )}

        <div className={`${panel} flex flex-col items-center justify-center gap-5 text-center`}>
          <Link to="/" className="font-display text-3xl tracking-[var(--misk-track,0)] text-ink">
            {store?.logo
              ? <img src={store.logo} alt={store.name} className="h-10 w-auto object-contain" />
              : store?.name || 'STORE'}
          </Link>
          <p className="max-w-xs text-sm text-muted">{aboutText}</p>
          {showSocial && social.length > 0 && (
            <>
              <span className="sr-only">{t('theme.footer.follow')}</span>
              <div className="flex gap-3">
                {social.map(([k, url]) => {
                  const Icon = (I as any)[k] || I.instagram;
                  return (
                    <a
                      key={k}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={k}
                      className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition-colors duration-300 hover:border-gold-ink hover:bg-sand hover:text-gold-ink"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {showWhats && (
          <div className={`${panel} flex flex-col justify-center gap-4 bg-sand text-center lg:text-start`}>
            <p className="font-display text-2xl leading-snug text-ink">{waHeading}</p>
            <p className="text-sm text-muted">{waText}</p>
            {waNumber ? (
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="misk-btn misk-btn-solid self-center lg:self-start"
              >
                <I.whatsapp className="h-5 w-5" /> {t('theme.whatsapp.cta')}
              </a>
            ) : (
              <Link to="/contact" className="misk-btn misk-btn-outline self-center lg:self-start">{t('theme.nav.contact')}</Link>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-4 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>{t('theme.footer.copyright', { year: new Date().getFullYear(), name: store?.name || '' })}</p>
          {showPayment && <FooterPaymentBadges />}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
