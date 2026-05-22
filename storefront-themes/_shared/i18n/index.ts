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
      // Pre-declare the per-theme `theme` namespace alongside the shared
      // namespaces so it's recognized even before `registerThemeResources`
      // populates content. Without this, components that call
      // `useTranslation(['theme'])` race the bundle registration on the
      // initial render and `t()` returns the raw key path.
      ns: [...Object.keys(sharedResources.en), 'theme'],
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
//
// `i18n.init()` is asynchronous — when this runs synchronously right
// after the i18n module loads, the resource store may not be ready yet
// and `addResourceBundle` is a silent no-op, leaving components to
// render raw key paths until the user triggers a re-render. We register
// once if init has resolved and again on the `initialized` event so
// either ordering wins.
export function registerThemeResources(themeResources: { en?: Record<string, unknown>; ar?: Record<string, unknown> }) {
  const apply = () => {
    if (themeResources.en) i18n.addResourceBundle('en', 'theme', themeResources.en, true, true)
    if (themeResources.ar) i18n.addResourceBundle('ar', 'theme', themeResources.ar, true, true)
  }
  if (i18n.isInitialized) {
    apply()
  } else {
    i18n.on('initialized', apply)
    // Some i18next versions resolve `init()` after firing `initialized`
    // synchronously — also apply right away so we don't depend on the
    // event for the case where the store is already populated.
    apply()
  }
}
