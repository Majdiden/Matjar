import React, { useState } from 'react';
import { useStore } from '../contexts/StoreContext';
import { contactApi } from '../api/client';
import { useTranslation } from 'react-i18next';
import { usePage } from '../hooks/usePage';
import { useContactInfo, telLink } from '../hooks/useContactInfo';
import { mapsSearchLink } from './ContactPage';

interface ContactProps {
  className?: string;
  accentColor?: string;
  heading?: string;
  subheading?: string;
}

const Contact: React.FC<ContactProps> = ({
  className = '',
  accentColor,
  heading,
  subheading,
}) => {
  const { store } = useStore();
  const { t } = useTranslation(['footer', 'generated']);
  // Merchant-authored CMS content (editable in the dashboard) shown above the
  // contact form so edits reflect on the storefront.
  const { page } = usePage('contact');
  // The store's own details only — no placeholder email or invented
  // opening hours; a detail the merchant never set is not shown.
  const info = useContactInfo();
  const email = info.email || (store as any)?.email || null;
  const phone = info.phone?.text || (store as any)?.phone || null;
  const address = info.address || (store as any)?.address || null;

  const SUBJECTS = [
    t('footer.contact.subject.general'),
    t('footer.contact.subject.order_support'),
    t('footer.contact.subject.returns'),
    t('footer.contact.subject.product'),
    t('footer.contact.subject.other'),
  ];

  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ringColor = accentColor || 'var(--color-primary, #2563eb)';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.message.trim().length < 10) {
      setError(t('footer.contact.error.message_too_short'));
      return;
    }

    setSubmitting(true);
    try {
      await contactApi.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject,
        message: form.message.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || t('footer.contact.error.default'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`max-w-4xl mx-auto px-4 sm:px-6 py-12 ${className}`}>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-2">{page?.title || heading || t('footer.contact.title')}</h1>
        {page && page.content ? (
          <div
            className="text-gray-600 leading-relaxed max-w-2xl mx-auto text-start [&_p]:mb-3 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        ) : (
          <p className="text-gray-500">{subheading || t('footer.contact.subtitle')}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Contact Info. Each value keeps its own direction (dir="auto"), so
            Arabic typed into an English page — or digits beside Arabic, like
            opening hours — reads in the right order, and each channel is a
            tap away: call or WhatsApp, email, the map. */}
        <div className="space-y-6">
          <InfoRow label={t('footer.contact.info.store')}>
            <span dir="auto">{store?.name || info.storeName}</span>
          </InfoRow>
          {phone && (
            <InfoRow label={t('footer.contact.info.phone')}>
              <span dir="ltr" className="inline-block">{phone}</span>
              <span className="mt-2 flex flex-wrap gap-2">
                {telLink(phone) && (
                  <ActionLink href={telLink(phone)!} color={ringColor}>{t('generated:pages.contact.call')}</ActionLink>
                )}
                {info.whatsapp && (
                  <ActionLink href={info.whatsapp.href} color={ringColor} external>
                    {t('generated:contact.whatsapp_button')}
                  </ActionLink>
                )}
              </span>
            </InfoRow>
          )}
          {!phone && info.whatsapp && (
            <InfoRow label="WhatsApp">
              <ActionLink href={info.whatsapp.href} color={ringColor} external>
                {t('generated:contact.whatsapp_button')}
              </ActionLink>
            </InfoRow>
          )}
          {email && (
            <InfoRow label={t('footer.contact.info.email')}>
              <a href={`mailto:${email}`} dir="ltr" className="inline-block break-all underline underline-offset-2" style={{ color: ringColor }}>
                {email}
              </a>
            </InfoRow>
          )}
          {address && (
            <InfoRow label={t('footer.contact.info.address')}>
              <span dir="auto" className="block whitespace-pre-line">{address}</span>
              <span className="mt-2 flex">
                <ActionLink href={mapsSearchLink(address)} color={ringColor} external>{t('generated:pages.contact.map')}</ActionLink>
              </span>
            </InfoRow>
          )}
          {info.hours && (
            <InfoRow label={t('footer.contact.info.hours')}>
              <span dir="auto" className="block whitespace-pre-line">{info.hours}</span>
            </InfoRow>
          )}
        </div>

        {/* Contact Form */}
        {submitted ? (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                style={{ color: ringColor }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold mb-2">{t('footer.contact.success_title')}</h3>
              <p className="text-gray-500">{t('footer.contact.success_description')}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('footer.contact.field.name.label')}</label>
              <input
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': ringColor } as React.CSSProperties}
                placeholder={t('footer.contact.field.name.placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('footer.contact.field.email.label')}</label>
              <input
                name="email"
                type="email" dir="ltr"
                required
                value={form.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
                placeholder={t('footer.contact.field.email.placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('footer.contact.field.subject.label')}</label>
              <select
                name="subject"
                value={form.subject}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2"
              >
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('footer.contact.field.message.label')}</label>
              <textarea
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                placeholder={t('footer.contact.field.message.placeholder')}
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-lg text-white font-medium transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: ringColor }}
            >
              {submitting ? t('footer.contact.submitting') : t('footer.contact.submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/** One contact detail: a label and its value (text-start, so it follows the page). */
const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <h3 className="font-semibold mb-2">{label}</h3>
    <div className="text-gray-600 text-sm text-start">{children}</div>
  </div>
);

/** A small outlined button for a contact action (call, WhatsApp, map). */
const ActionLink: React.FC<{ href: string; color: string; external?: boolean; children: React.ReactNode }> = ({
  href,
  color,
  external,
  children,
}) => (
  <a
    href={href}
    className="inline-flex min-h-[40px] items-center rounded-full border px-4 text-sm font-semibold transition hover:opacity-80"
    style={{ color, borderColor: color }}
    {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
  >
    {children}
  </a>
);

export default Contact;
