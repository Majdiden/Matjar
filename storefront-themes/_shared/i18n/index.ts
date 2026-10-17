import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { sharedResources } from './resources'

const STORAGE_KEY = 'matjar.storefront.lang'

export type StoreLang = 'en' | 'ar'
/** A store with no language set opens in Arabic. */
export const DEFAULT_STORE_LANG: StoreLang = 'ar'

const asLang = (v: unknown): StoreLang | null => (v === 'ar' || v === 'en' ? v : null)

/** The store's language from the payload embedded in the page (storefrontServe). */
const embeddedStoreLang = (): StoreLang | null => {
  try {
    const raw = document.getElementById('__MATJAR_STORE__')?.textContent
    return raw ? asLang(JSON.parse(raw)?.language) : null
  } catch {
    return null
  }
}

/**
 * The language the shopper picked during this visit: the switcher, or a link
 * ending in ?lang=en / ?lang=ar (which then sticks for the visit). Kept per
 * tab session, so every new visit to the store link opens in the store's
 * language rather than whatever was picked last time.
 */
export const readShopperLang = (): StoreLang | null => {
  try {
    const fromUrl = asLang(new URLSearchParams(window.location.search).get('lang'))
    if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl)
    return fromUrl || asLang(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export const saveShopperLang = (lang: StoreLang) => {
  try { sessionStorage.setItem(STORAGE_KEY, lang) } catch { /* storage unavailable */ }
}

/** Opening language: the shopper's pick this visit → the store's language → Arabic. */
const initialLang = (): StoreLang =>
  (typeof window === 'undefined' ? null : readShopperLang() || embeddedStoreLang()) || DEFAULT_STORE_LANG

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      lng: initialLang(),
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
