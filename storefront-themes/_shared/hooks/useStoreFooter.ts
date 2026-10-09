/**
 * Footer content from the store's own data, for every theme (PBI 10).
 *
 * Footers used to ship theme demo links ("Banana milk", "Our farmers",
 * "Sustainability") and English labels on Arabic stores. Each theme keeps its
 * own footer markup but takes its content from here:
 *   - description: the brand tagline, else the store description;
 *   - shop: all products + the store's real categories;
 *   - help: about and contact;
 *   - policies: the store's published policies, titled in the shopper's
 *     language (lib/policies.ts);
 *   - social / contact: what the merchant has set (hooks/useContactInfo.ts);
 *   - copyright: "© 2026 Store name".
 * Labels come from the shared `footer` namespace, so they follow the
 * storefront language.
 */
import { useTranslation } from 'react-i18next';
import { useStore } from '../contexts/StoreContext';
import { useCategories } from './useProducts';
import { pickBrandText, useContactInfo, type ContactInfo } from './useContactInfo';
import { publishedPolicies } from '../lib/policies';

export interface FooterLink {
  label: string;
  to: string;
}

export interface StoreFooter {
  storeName: string;
  logo: string | null;
  description: string | null;
  shop: FooterLink[];
  help: FooterLink[];
  policies: FooterLink[];
  social: ContactInfo['socialLinks'];
  contact: Pick<ContactInfo, 'whatsapp' | 'phone' | 'email' | 'address'>;
  /** Column titles, already translated. */
  titles: { shop: string; help: string; policies: string; follow: string };
  copyright: string;
}

/** Categories shown under "Shop" before the list gets long. */
export const FOOTER_MAX_CATEGORIES = 5;

export function useStoreFooter({ maxCategories = FOOTER_MAX_CATEGORIES }: { maxCategories?: number } = {}): StoreFooter {
  const { store } = useStore();
  const { t, i18n } = useTranslation(['footer', 'common']);
  const { categories } = useCategories();
  const contact = useContactInfo();
  const lang = i18n.language || 'ar';
  const storeName = store?.name || '';

  const shop: FooterLink[] = [
    { label: t('footer:footer.store_footer.all_products'), to: '/products' },
    ...(categories || [])
      .filter((c: any) => c?.slug && c?.name)
      .slice(0, maxCategories)
      .map((c: any) => ({ label: String(c.name), to: `/categories/${c.slug}` })),
  ];

  const help: FooterLink[] = [
    { label: t('footer:footer.store_footer.about'), to: '/about' },
    { label: t('footer:footer.store_footer.contact'), to: '/contact' },
  ];

  const policies = publishedPolicies(store, t).map((p) => ({ label: p.title, to: p.path }));

  return {
    storeName,
    logo: store?.logo || null,
    description: pickBrandText(store?.brand?.tagline, lang) || store?.description?.trim() || null,
    shop,
    help,
    policies,
    social: contact.socialLinks,
    contact: { whatsapp: contact.whatsapp, phone: contact.phone, email: contact.email, address: contact.address },
    titles: {
      shop: t('footer:footer.store_footer.shop'),
      help: t('footer:footer.store_footer.help'),
      policies: t('footer:footer.store_footer.policies'),
      follow: t('footer:footer.store_footer.follow'),
    },
    copyright: t('footer:footer.store_footer.copyright', { year: new Date().getFullYear(), name: storeName }),
  };
}
