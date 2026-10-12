import { useTranslation } from 'react-i18next';
import { languageOrder, uiLanguageFirst, type FieldLang } from '../lib/languageOrder';
import { getStoreLanguage } from '../lib/format';

/**
 * The dashboard's language-pair order for the current UI language (see
 * lib/languageOrder.ts): `order` is ['ar', 'en'] in Arabic and ['en', 'ar']
 * in English; `sort(items)` puts the UI language's items first;
 * `storeLang` is the store's own language (where base fields are written).
 */
export function useLanguageOrder() {
  const { i18n } = useTranslation();
  const language = i18n.language;
  return {
    order: languageOrder(language),
    first: languageOrder(language)[0],
    storeLang: getStoreLanguage(),
    sort: <T extends { lang: FieldLang }>(items: readonly T[]) => uiLanguageFirst(items, language),
  };
}
