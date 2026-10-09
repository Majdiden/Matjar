import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { useContactInfo } from '../hooks/useContactInfo';
import { useThemeSlot } from '../theme/ThemeSlotsProvider';
import { FG, MUTED, PAGE_SLOT, PRIMARY_INK, usePageStyleTokens } from '../theme/pageStyle';
import { PageHero } from '../components/pages/PageHero';
import { PageContainer } from '../components/pages/PageLayout';
import { SocialLinks } from '../components/pages/SocialLinks';
import { WhatsAppButton } from '../components/pages/ContactCta';
import { PageIcon, type PageIconName } from '../components/pages/PageIcon';

interface ContactPageProps {
  className?: string;
}

/** Map search for a typed address — opens the maps app on phones. */
export const mapsSearchLink = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

interface Channel {
  key: string;
  icon: PageIconName;
  label: string;
  value: React.ReactNode;
  href?: string | null;
  action?: string;
  external?: boolean;
}

/**
 * Contact page built from the store's own data (PBI 10-10) — rendered for
 * /contact and /pages/contact when the merchant switched on the automatic
 * contact page (see app/createThemeApp.tsx). A big WhatsApp button first
 * (most customers in our market message rather than email), then a card per
 * channel — phone, email, address, hours — each only when set and each a
 * tap away (call, write, open the map), then the social pages.
 * A theme can replace it through the `page.contact` slot.
 */
const ContactPage: React.FC<ContactPageProps> = (props) => {
  const Slot = useThemeSlot<React.ComponentType<ContactPageProps>>(PAGE_SLOT.contact);
  return Slot ? <Slot {...props} /> : <AutoContactPage {...props} />;
};

const AutoContactPage: React.FC<ContactPageProps> = ({ className = '' }) => {
  const { t } = useTranslation('generated');
  const { store } = useStore();
  const info = useContactInfo();
  const tk = usePageStyleTokens();

  const channels: Channel[] = [];
  if (info.phone) {
    channels.push({
      key: 'phone',
      icon: 'phone',
      label: t('contact.phone'),
      value: <span dir="ltr">{info.phone.text}</span>,
      href: info.phone.href,
      action: t('pages.contact.call'),
    });
  }
  if (info.email) {
    channels.push({
      key: 'email',
      icon: 'mail',
      label: t('contact.email'),
      value: <span dir="ltr" className="break-all">{info.email}</span>,
      href: `mailto:${info.email}`,
      action: t('pages.contact.write'),
    });
  }
  if (info.address || info.city) {
    const place = [info.address, info.city].filter(Boolean).join(', ');
    channels.push({
      key: 'address',
      icon: 'pin',
      label: info.address ? t('contact.address') : t('contact.city'),
      value: (
        <>
          {info.address && <span className="block whitespace-pre-line">{info.address}</span>}
          {info.city && <span className={info.address ? 'block text-sm mt-0.5' : ''} style={info.address ? { color: MUTED } : undefined}>{info.city}</span>}
        </>
      ),
      href: mapsSearchLink(place),
      action: t('pages.contact.map'),
      external: true,
    });
  }
  if (info.hours) {
    channels.push({
      key: 'hours',
      icon: 'clock',
      label: t('contact.hours'),
      value: <span className="whitespace-pre-line">{info.hours}</span>,
    });
  }

  const gap = tk.style === 'editorial' ? 'py-10 sm:py-14' : 'py-8 sm:py-10';

  return (
    <div className={`pb-12 sm:pb-16 ${className}`}>
      <PageHero
        eyebrow={store?.name}
        title={t('contact.title')}
        subtitle={t('contact.subtitle')}
        image={store?.brand?.coverImage || null}
      />

      <PageContainer className={gap}>
        {info.whatsapp && (
          <div className="mb-8 sm:mb-10">
            <WhatsAppButton />
            <p className="mt-3 text-sm text-center" style={{ color: MUTED }}>
              {t('pages.contact.whatsapp_hint')}
            </p>
          </div>
        )}

        {channels.length > 0 && (
          <>
            {info.whatsapp && (
              <p className={`${tk.eyebrowClass} mb-3 text-center`} style={{ color: MUTED }}>
                {t('pages.contact.other_ways')}
              </p>
            )}
            <ul className={`grid grid-cols-1 sm:grid-cols-2 ${tk.style === 'editorial' ? 'gap-x-8' : 'gap-3'}`}>
              {channels.map((c) => (
                <li key={c.key} className="min-w-0">
                  <ChannelCard channel={c} />
                </li>
              ))}
            </ul>
          </>
        )}

        <SocialLinks className="mt-10" />
      </PageContainer>
    </div>
  );
};

/** One contact channel; the whole card is the tap target when it has an action. */
const ChannelCard: React.FC<{ channel: Channel }> = ({ channel: c }) => {
  const tk = usePageStyleTokens();
  const { style } = tk;
  const iconSize = style === 'bold' ? 'h-12 w-12' : style === 'clean' ? 'h-11 w-11' : 'h-8 w-8';
  const body = (
    <>
      <span className={`inline-flex items-center justify-center ${iconSize}`} style={tk.iconBox}>
        <PageIcon name={c.icon} className={style === 'bold' ? 'w-6 h-6' : 'w-5 h-5'} strokeWidth={style === 'bold' ? 2 : style === 'editorial' ? 1.4 : 1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block mb-0.5 ${style === 'editorial' ? tk.eyebrowClass : 'text-sm'}`} style={{ color: MUTED }}>
          {c.label}
        </span>
        <span className={`block break-words ${style === 'bold' ? 'font-bold text-lg' : 'font-semibold'}`} style={{ color: FG }}>
          {c.value}
        </span>
        {c.href && c.action && (
          <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: PRIMARY_INK }}>
            {c.action}
            <PageIcon name="arrow" className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        )}
      </span>
    </>
  );
  const cls = `flex items-start gap-4 h-full ${style === 'editorial' ? 'py-5' : 'p-4 sm:p-5'}`;

  return c.href ? (
    <a
      href={c.href}
      className={`${cls} transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
      style={tk.card}
      {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {body}
    </a>
  ) : (
    <div className={cls} style={tk.card}>
      {body}
    </div>
  );
};

export default ContactPage;
