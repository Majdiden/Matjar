import React from 'react';
import { useTranslation } from 'react-i18next';
import { useContactInfo } from '../hooks/useContactInfo';

interface ContactPageProps {
  className?: string;
}

/** WhatsApp's own green, so the button reads as "WhatsApp" at a glance. */
const WHATSAPP_GREEN = '#25D366';

const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.71.23 1.36.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 01-4.8-1.31l-.34-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 01-1.45-5.03c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.9.99 6.68 2.77a9.38 9.38 0 012.76 6.68c0 5.2-4.24 9.44-9.45 9.44zm8.04-17.48A11.3 11.3 0 0012.04.7C5.77.7.66 5.8.66 12.07c0 2 .52 3.96 1.52 5.69L.57 23.6l5.98-1.57a11.33 11.33 0 005.43 1.38h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.18-5.9-3.33-8.04z" />
  </svg>
);

/**
 * Contact page built from the store's own data (PBI 10-10) — rendered for
 * /contact and /pages/contact when the merchant switched on the automatic
 * contact page (see app/createThemeApp.tsx). A big WhatsApp button first
 * (most customers in our market message rather than email), then phone,
 * email, address, city, hours and social pages — each row only when set.
 */
const ContactPage: React.FC<ContactPageProps> = ({ className = '' }) => {
  const { t } = useTranslation('generated');
  const info = useContactInfo();

  const rows: Array<{ key: string; label: string; value: React.ReactNode }> = [];
  if (info.phone) {
    rows.push({
      key: 'phone',
      label: t('contact.phone'),
      value: info.phone.href ? (
        <a href={info.phone.href} dir="ltr" className="underline">{info.phone.text}</a>
      ) : (
        <span dir="ltr">{info.phone.text}</span>
      ),
    });
  }
  if (info.email) {
    rows.push({
      key: 'email',
      label: t('contact.email'),
      value: <a href={`mailto:${info.email}`} dir="ltr" className="underline break-all">{info.email}</a>,
    });
  }
  if (info.address) {
    rows.push({ key: 'address', label: t('contact.address'), value: <span className="whitespace-pre-line">{info.address}</span> });
  }
  if (info.city) rows.push({ key: 'city', label: t('contact.city'), value: info.city });
  if (info.hours) rows.push({ key: 'hours', label: t('contact.hours'), value: <span className="whitespace-pre-line">{info.hours}</span> });

  return (
    <div className={`max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-12 ${className}`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('contact.title')}</h1>
        <p style={{ color: 'var(--color-muted, #6b7280)' }}>{t('contact.subtitle')}</p>
      </div>

      {info.whatsapp && (
        <a
          href={info.whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-xl text-white text-lg font-semibold shadow-sm transition hover:opacity-90 mb-8"
          style={{ backgroundColor: WHATSAPP_GREEN }}
        >
          <WhatsAppIcon className="w-7 h-7 shrink-0" />
          <span>{t('contact.whatsapp_button')}</span>
        </a>
      )}

      {rows.length > 0 && (
        <dl
          className="rounded-xl border divide-y"
          style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
        >
          {rows.map((row) => (
            <div key={row.key} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-3">
              <dt className="sm:w-36 shrink-0 text-sm" style={{ color: 'var(--color-muted, #6b7280)' }}>
                {row.label}
              </dt>
              <dd className="font-medium min-w-0">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {info.socialLinks.length > 0 && (
        <div className="mt-8 text-center">
          <h2 className="text-sm font-semibold mb-3">{t('contact.follow')}</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {info.socialLinks.map((s) => (
              <a
                key={s.platform}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-full border text-sm hover:opacity-80 transition"
                style={{ borderColor: 'var(--color-border, #e5e7eb)' }}
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactPage;
