import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import type { BrandText } from '../types/commerce';

/**
 * Contact details built from the store's own data (PBI 10-10): the brand
 * kit (WhatsApp, city, hours), `settings.contact` (phone, email, address)
 * and the social pages. Nothing is copied into a Page, so the contact page
 * always shows what the merchant has set right now.
 */

/** Social platforms in display order; names are brand names (same in every language). */
export const SOCIAL_PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  x: 'X',
};

/** Brand-kit text in the visitor's language: English falls back to Arabic and vice versa. */
export function pickBrandText(text: BrandText | null | undefined, lang: string): string | null {
  if (!text) return null;
  const primary = lang.startsWith('en') ? text.en : text.ar;
  return primary || text.ar || text.en || null;
}

/** wa.me chat link for an E.164 number, with a short prefilled message. */
export function whatsappLink(e164: string, message?: string): string {
  const digits = e164.replace(/\D/g, '');
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${digits}${text}`;
}

/** `tel:` link for a typed phone number — digits and a leading "+" only. */
export function telLink(phone: string): string | null {
  const cleaned = phone.trim().replace(/(?!^\+)[^\d]/g, '');
  return /\d{3,}/.test(cleaned) ? `tel:${cleaned}` : null;
}

export interface ContactInfo {
  storeName: string;
  whatsapp: { href: string; display: string } | null;
  phone: { text: string; href: string | null } | null;
  email: string | null;
  address: string | null;
  city: string | null;
  hours: string | null;
  socialLinks: Array<{ platform: string; name: string; url: string }>;
}

/** True when the merchant switched on the automatic contact page. */
export function useAutoContactEnabled(): boolean {
  return useStore().store?.generatedPages?.contact === true;
}

/** The store's contact details in the visitor's language. */
export function useContactInfo(): ContactInfo {
  const { store } = useStore();
  const { t, i18n } = useTranslation('generated');
  const lang = i18n.language || 'ar';
  const brand = store?.brand || null;
  const contact = store?.contact || null;
  const storeName = store?.name || '';

  const socialLinks = Object.keys(SOCIAL_PLATFORM_NAMES)
    .filter((platform) => typeof store?.socialLinks?.[platform] === 'string' && store.socialLinks[platform])
    .map((platform) => ({
      platform,
      name: SOCIAL_PLATFORM_NAMES[platform],
      url: store!.socialLinks![platform],
    }));

  const phoneText = contact?.phone?.trim() || '';

  return {
    storeName,
    whatsapp: brand?.whatsapp
      ? {
          href: whatsappLink(brand.whatsapp, t('contact.whatsapp_message', { name: storeName })),
          display: brand.whatsapp,
        }
      : null,
    phone: phoneText ? { text: phoneText, href: telLink(phoneText) } : null,
    email: contact?.email?.trim() || null,
    address: contact?.address?.trim() || null,
    city: pickBrandText(brand?.city, lang),
    hours: pickBrandText(brand?.hours, lang),
    socialLinks,
  };
}
