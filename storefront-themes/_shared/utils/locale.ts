/**
 * Locale for every date, time and number the storefront formats: the
 * shopper's language with Latin digits (0-9). Without it, phones set to
 * Arabic showed Arabic-Indic digits (٠١٢) in dates while prices, order
 * numbers and phone numbers used 0-9.
 */
import i18n from '../i18n';

export const storefrontLocale = (): string =>
  (i18n.resolvedLanguage || i18n.language || 'en').startsWith('ar') ? 'ar-SD-u-nu-latn' : 'en-US';
