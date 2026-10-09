import React from 'react';
import { Link } from 'react-router-dom';
import { useThemeSetting } from '@matjar/theme-shared/theme/ThemeProvider';
import { useStoreFooter } from '@matjar/theme-shared/hooks/useStoreFooter';
import { merchantText } from '@matjar/theme-shared/theme/heroContent';
import { SocialIcon } from '@matjar/theme-shared/components/pages/PageIcon';
import { FooterPaymentBadges } from '@matjar/theme-shared/components/commerce/FooterPaymentBadges';
import { I } from '../lib/icons';

/**
 * Four columns: brand + about · shop (all products + categories) · help and
 * policies · contact. Social icons, payment badges and copyright below.
 * Content comes from the store's own data (useStoreFooter), never demo copy.
 */
export const Footer: React.FC = () => {
  const footer = useStoreFooter();
  const aboutSetting = useThemeSetting<string>('footer_about');
  const hoursSetting = useThemeSetting<string>('opening_hours');
  // Merchant copy only: the footer "about" setting, else the store's tagline/description.
  const about = merchantText(aboutSetting) || footer.description;
  const hours = merchantText(hoursSetting);
  const { whatsapp, phone, email, address } = footer.contact;
  const hasContact = !!(whatsapp || phone || email || address || hours || footer.social.length);
  const contactTitle = footer.help.find((l) => l.to === '/contact')?.label;
  const linkCls = 'block py-1 text-[0.95rem] text-dune transition-colors duration-300 hover:text-clay';

  return (
    <footer className="mt-16 border-t border-line bg-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6">
        <div className={`grid gap-10 md:grid-cols-2 ${hasContact ? 'lg:grid-cols-[1.4fr_1fr_1fr_1fr]' : 'lg:grid-cols-[1.4fr_1fr_1fr]'}`}>
          <div>
            <Link to="/" className="font-heading text-2xl tracking-[0.2em] text-ink">
              {footer.logo ? <img src={footer.logo} alt={footer.storeName} className="h-10 w-auto object-contain" /> : footer.storeName.toUpperCase()}
            </Link>
            {about && <p className="mt-4 max-w-sm text-[0.95rem] text-dune">{about}</p>}
          </div>

          <div>
            <p className="linen-eyebrow mb-4 text-ink">{footer.titles.shop}</p>
            <ul>
              {footer.shop.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
            </ul>
          </div>

          <div>
            <p className="linen-eyebrow mb-4 text-ink">{footer.titles.help}</p>
            <ul>
              {footer.help.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
            </ul>
            {footer.policies.length > 0 && (
              <>
                <p className="linen-eyebrow mb-4 mt-8 text-ink">{footer.titles.policies}</p>
                <ul>
                  {footer.policies.map((l) => <li key={l.to}><Link to={l.to} className={linkCls}>{l.label}</Link></li>)}
                </ul>
              </>
            )}
          </div>

          {hasContact && (
            <div className="text-[0.95rem] text-dune">
              <p className="linen-eyebrow mb-4 text-ink">{contactTitle}</p>
              {address && <p className="mb-2">{address}</p>}
              {phone && (phone.href
                ? <a href={phone.href} className="block hover:text-clay" dir="ltr">{phone.text}</a>
                : <p dir="ltr">{phone.text}</p>)}
              {whatsapp && <a href={whatsapp.href} target="_blank" rel="noopener noreferrer" className="block hover:text-clay" dir="ltr">{whatsapp.display}</a>}
              {email && <a href={`mailto:${email}`} className="block hover:text-clay" dir="ltr">{email}</a>}
              {hours && <p className="mt-3">{hours}</p>}
              {footer.social.length > 0 && (
                <>
                  <p className="linen-eyebrow mb-3 mt-6 text-ink">{footer.titles.follow}</p>
                  <div className="flex gap-2">
                    {footer.social.map((l) => {
                      const Icon = (I as any)[l.platform];
                      return (
                        <a key={l.platform} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.name} className="grid h-10 w-10 place-items-center border border-line text-ink transition-colors hover:border-bronze hover:bg-bronze hover:text-cream">
                          {Icon ? <Icon className="h-4 w-4" /> : <SocialIcon platform={l.platform} className="h-4 w-4" />}
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-sm text-dune md:flex-row md:items-center md:justify-between">
          <p>{footer.copyright}</p>
          <FooterPaymentBadges />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
