import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { sharedResources } from './resources'

const STORAGE_KEY = 'matjar.storefront.lang'

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: sharedResources,
      fallbackLng: 'en',
      supportedLngs: ['en', 'ar'],
      nonExplicitSupportedLngs: true,
      ns: Object.keys(sharedResources.en),
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: STORAGE_KEY,
        caches: ['localStorage'],
      },
      returnEmptyString: false,
      returnNull: false,
    })
}

export default i18n
export const STORAGE_KEY_LANG = STORAGE_KEY

// Per-theme bootstrap helper: themes call this in main.tsx with their
// theme-specific bundle to merge their `theme` namespace on top.
export function registerThemeResources(themeResources: { en?: Record<string, unknown>; ar?: Record<string, unknown> }) {
  if (themeResources.en) i18n.addResourceBundle('en', 'theme', themeResources.en, true, true)
  if (themeResources.ar) i18n.addResourceBundle('ar', 'theme', themeResources.ar, true, true)
}
