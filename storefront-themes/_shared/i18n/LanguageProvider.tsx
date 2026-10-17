import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18nInstance, { saveShopperLang } from './index'

type Lang = 'en' | 'ar'
type Dir = 'ltr' | 'rtl'

interface LanguageContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  dir: Dir
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => undefined,
  dir: 'ltr',
})

// i18next starts in the opening language (./index → initialLang: the
// shopper's pick this visit, else the store's language, else Arabic), so the
// provider starts from whatever i18next loaded.
const resolveInitialLang = (): Lang => ((i18nInstance.language || '').startsWith('en') ? 'en' : 'ar')

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  const firstLangRun = useRef(true)

  // LAYOUT effect: a passive effect runs after the browser paints, so an
  // Arabic shopper got one LTR frame before the document flipped to RTL —
  // the whole page visibly jumping sides on every refresh. The language is
  // resolved synchronously at init (see resolveInitialLang), so writing
  // dir/lang before paint costs nothing and makes the first frame correct.
  useLayoutEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    document.body.dir = dir

    // Switching language flips direction (LTR↔RTL) and swaps every string at
    // once — a hard, jarring cut. Soften it: hide the page for a frame (content
    // + direction swap while invisible), then fade the new language in. Skip
    // the initial mount so first paint isn't a fade-in. Respect reduced motion.
    if (firstLangRun.current) {
      firstLangRun.current = false
      return
    }
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return

    const el = document.body
    el.style.transition = 'none'
    el.style.opacity = '0'
    const raf = requestAnimationFrame(() => {
      el.style.transition = 'opacity 260ms ease'
      el.style.opacity = '1'
    })
    return () => cancelAnimationFrame(raf)
  }, [lang, dir])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const newLang: Lang = lng.startsWith('ar') ? 'ar' : 'en'
      setLangState(newLang)
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  const setLang = (newLang: Lang) => {
    saveShopperLang(newLang)
    void i18n.changeLanguage(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, dir }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
