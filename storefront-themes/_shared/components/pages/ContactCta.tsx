import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useContactInfo } from '../../hooks/useContactInfo';
import { FG, MUTED, BORDER, PRIMARY_COLOR, tint, useOnPrimary, usePageStyleTokens } from '../../theme/pageStyle';
import { PageContainer } from './PageLayout';
import { PageIcon, WhatsAppIcon } from './PageIcon';

/** WhatsApp's own green, so the button reads as "WhatsApp" at a glance. */
export const WHATSAPP_GREEN = '#25D366';
/** Text on the green: WhatsApp's dark green-black, readable at any size. */
const WHATSAPP_TEXT = '#0b2e1a';

/** The big WhatsApp button; nothing when the store has no WhatsApp number. */
export const WhatsAppButton: React.FC<{ className?: string; label?: string }> = ({ className = '', label }) => {
  const { t } = useTranslation('generated');
  const { whatsapp } = useContactInfo();
  const tk = usePageStyleTokens();
  if (!whatsapp) return null;
  return (
    <a
      href={whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-3 w-full whitespace-nowrap min-h-[3.5rem] py-3.5 px-6 text-lg font-bold shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${className}`}
      style={{ ...tk.button, backgroundColor: WHATSAPP_GREEN, color: WHATSAPP_TEXT }}
    >
      <WhatsAppIcon className="w-7 h-7 shrink-0" />
      <span>{label || t('contact.whatsapp_button')}</span>
    </a>
  );
};

/**
 * Closing call to action: message us on WhatsApp (when the store has a
 * number) and keep browsing. Without WhatsApp the browse button becomes the
 * main action, with a link to the contact page next to it.
 */
export const ContactCta: React.FC<{
  title?: string;
  text?: string;
  className?: string;
  /** Hide the "Contact us" fallback link (e.g. on the contact page itself). */
  hideContactLink?: boolean;
}> = ({ title, text, className = '', hideContactLink = false }) => {
  const { t } = useTranslation('generated');
  const { whatsapp } = useContactInfo();
  const tk = usePageStyleTokens();
  const onPrimary = useOnPrimary();
  const { style } = tk;
  const boxStyle: React.CSSProperties =
    style === 'bold'
      ? { background: tint(12), borderRadius: tk.radius }
      : style === 'editorial'
        ? { borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }
        : { background: tint(5), border: `1px solid ${tint(14)}`, borderRadius: tk.radius };
  const secondary: React.CSSProperties = { ...tk.button, color: FG, border: `1px solid ${style === 'bold' ? tint(40) : BORDER}` };
  const primary: React.CSSProperties = { ...tk.button, background: PRIMARY_COLOR, color: onPrimary };

  return (
    <section className={className}>
      <PageContainer>
        <div className={`text-center ${style === 'editorial' ? 'py-10 sm:py-12' : 'px-5 py-8 sm:px-10 sm:py-10'}`} style={boxStyle}>
          <h2 className={`${tk.headingClass} leading-tight`} style={tk.heading}>
            {title || t('pages.cta.title')}
          </h2>
          <p className="mt-2 mb-6 max-w-md mx-auto leading-relaxed" style={{ color: MUTED }}>
            {text || t('pages.cta.text')}
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-3 mx-auto">
            {whatsapp ? (
              <WhatsAppButton className="sm:w-auto" />
            ) : (
              !hideContactLink && (
                <Link to="/contact" className="inline-flex items-center justify-center gap-2 whitespace-nowrap min-h-[3rem] px-6 font-semibold transition hover:opacity-90" style={primary}>
                  <PageIcon name="chat" className="w-5 h-5" />
                  <span>{t('contact.title')}</span>
                </Link>
              )
            )}
            <Link
              to="/products"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap min-h-[3rem] px-6 font-semibold transition hover:opacity-80"
              style={!whatsapp && hideContactLink ? primary : secondary}
            >
              <PageIcon name="bag" className="w-5 h-5" />
              <span>{t('pages.cta.browse')}</span>
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
};

export default ContactCta;
