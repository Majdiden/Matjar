import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { merchantText } from '@matjar/theme-shared/theme/heroContent';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { I } from '../lib/icons';

/**
 * Four panels divided by hairlines: help + contact · shop links and policies ·
 * wordmark and social · a WhatsApp block. The reference theme puts a
 * newsletter signup in the last panel; newsletters were removed platform-wide,
 * and for this audience a WhatsApp hand-off converts far better anyway.
 *
 * Content comes from the store's own data (useStoreFooter) — no demo copy.
 * Every panel is individually switchable from the customizer, and the grid
 * collapses to one column per panel on phones rather than squeezing four.
 */
export const Footer: React.FC = () => {
  const { t } = useTranslation(['theme']);
  const footer = useStoreFooter();

  const showContact = useThemeSetting<boolean>('footer_show_contact') !== false;
  const showMenu = useThemeSetting<boolean>('footer_show_menu') !== false;
  const showSocial = useThemeSetting<boolean>('footer_show_social') !== false;
  const showPayment = useThemeSetting<boolean>('footer_show_payment') !== false;
  const background = useThemeSetting<string>('footer_background');
  const aboutText = merchantText(useThemeSetting<string>('footer_about')) || footer.description;

  // WhatsApp block: only when the store has a number; heading/text only when the merchant wrote them.
  const waNumber = (useThemeSetting<string>('whatsapp_number') || '').replace(/[^\d]/g, '');
  const waHref = waNumber ? `https://wa.me/${waNumber}` : footer.contact.whatsapp?.href || null;
  const showWhats = useThemeSetting<boolean>('show_whatsapp_block') !== false && !!waHref;
  const waHeading = merchantText(useThemeSetting<string>('whatsapp_heading'));
  const waText = merchantText(useThemeSetting<string>('whatsapp_text'));

  const { phone, email, address } = footer.contact;

  const linkCls = 'block py-1.5 text-sm text-muted transition-colors duration-300 hover:text-ink';
  const panel = 'px-6 py-10 lg:px-10';
  const panels = [showContact, showMenu, true, showWhats].filter(Boolean).length;
  const cols = panels >= 4 ? 'lg:grid-cols-4' : panels === 3 ? 'lg:grid-cols-3' : panels === 2 ? 'lg:grid-cols-2' : '';

  return (
    <footer className="misk-footer border-t border-line" style={background ? { background } : undefined}>
      <div className={`mx-auto grid max-w-[1320px] divide-y divide-line ${cols} lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse`}>
        {showContact && (
          <div className={panel}>
            <p className="misk-eyebrow mb-5 text-ink">{footer.titles.help}</p>
            <ul>
              {footer.help.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
            </ul>
            {(address || phone || email) && (
              <div className="mt-4 space-y-2 text-sm text-muted">
                {address && <p className="flex items-start gap-2"><I.pin className="mt-0.5 h-4 w-4 shrink-0" />{address}</p>}
                {phone && (phone.href ? (
                  <a href={phone.href} className="flex items-center gap-2 transition-colors hover:text-ink">
                    <I.phone className="h-4 w-4 shrink-0" /><span dir="ltr">{phone.text}</span>
                  </a>
                ) : (
                  <p className="flex items-center gap-2"><I.phone className="h-4 w-4 shrink-0" /><span dir="ltr">{phone.text}</span></p>
                ))}
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-2 transition-colors hover:text-ink">
                    <I.mail className="h-4 w-4 shrink-0" /><span dir="ltr">{email}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {showMenu && (
          <div className={panel}>
            <p className="misk-eyebrow mb-5 text-ink">{footer.titles.shop}</p>
            <ul>
              {footer.shop.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
            </ul>
            {footer.policies.length > 0 && (
              <>
                <p className="misk-eyebrow mb-3 mt-6 text-ink">{footer.titles.policies}</p>
                <ul>
                  {footer.policies.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
                </ul>
              </>
            )}
          </div>
        )}

        <div className={`${panel} flex flex-col items-center justify-center gap-5 text-center`}>
          <Link to="/" className="font-display text-3xl tracking-[var(--misk-track,0)] text-ink">
            {footer.logo
              ? <img src={footer.logo} alt={footer.storeName} className="h-10 w-auto object-contain" />
              : footer.storeName}
          </Link>
          {aboutText && <p className="max-w-xs text-sm text-muted">{aboutText}</p>}
          {showSocial && footer.social.length > 0 && (
            <>
              <span className="sr-only">{footer.titles.follow}</span>
              <div className="flex gap-3">
                {footer.social.map((l) => {
                  const Icon = (I as any)[l.platform];
                  return (
                    <a
                      key={l.platform}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={l.name}
                      className="grid h-11 w-11 place-items-center rounded-full border border-line text-ink transition-colors duration-300 hover:border-gold-ink hover:bg-sand hover:text-gold-ink"
                    >
                      {Icon ? <Icon className="h-4 w-4" /> : <SocialIcon platform={l.platform} className="h-4 w-4" />}
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {showWhats && waHref && (
          <div className={`${panel} flex flex-col justify-center gap-4 bg-sand text-center lg:text-start`}>
            {waHeading && <p className="font-display text-2xl leading-snug text-ink">{waHeading}</p>}
            {waText && <p className="text-sm text-muted">{waText}</p>}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="misk-btn misk-btn-solid self-center lg:self-start"
            >
              <I.whatsapp className="h-5 w-5" /> {t('theme.whatsapp.cta')}
            </a>
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1320px] flex-col items-center gap-4 px-4 py-6 text-sm text-muted sm:flex-row sm:justify-between sm:px-6">
          <p>{footer.copyright}</p>
          {showPayment && <FooterPaymentBadges />}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
