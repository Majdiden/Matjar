import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18nInstance, { STORAGE_KEY_LANG } from './index'

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

// i18next's LanguageDetector runs synchronously during init, so by the time
// this provider mounts `i18nInstance.language` reflects the resolved choice
// (stored preference → navigator language → fallback). Reading from there
// keeps the provider state aligned with what i18next actually loaded; reading
// only localStorage misses the navigator path used on first visit.
const resolveInitialLang = (): Lang => {
  const detected = i18nInstance.language || ''
  if (detected.startsWith('ar')) return 'ar'
  if (detected.startsWith('en')) return 'en'
  try {
    const stored = localStorage.getItem(STORAGE_KEY_LANG)
    return stored === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [lang, setLangState] = useState<Lang>(resolveInitialLang)

  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'
  const firstLangRun = useRef(true)

  useEffect(() => {
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
    try { localStorage.setItem(STORAGE_KEY_LANG, newLang) } catch { /* storage unavailable */ }
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
