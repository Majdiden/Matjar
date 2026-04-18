import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { STORAGE_KEY_LANG } from './index'

type Lang = 'en' | 'ar'
type Dir = 'ltr' | 'rtl'

interface LanguageContextValue {
  lang: Lang
  dir: Dir
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  dir: 'ltr',
  setLang: () => {},
})

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { i18n } = useTranslation()
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY_LANG)
    return (stored === 'ar' || stored === 'en') ? stored : 'en'
  })

  const dir: Dir = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      const newLang: Lang = lng === 'ar' ? 'ar' : 'en'
      setLangState(newLang)
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  const setLang = (newLang: Lang) => {
    localStorage.setItem(STORAGE_KEY_LANG, newLang)
    void i18n.changeLanguage(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, dir, setLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
