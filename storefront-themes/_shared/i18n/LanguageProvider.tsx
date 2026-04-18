import React, { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './index'

interface LanguageContextValue {
  lang: string
  setLang: (lang: string) => void
  dir: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => undefined,
  dir: 'ltr',
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const [lang, setLangState] = useState<string>(i18n.language || 'en')

  const dir: 'ltr' | 'rtl' = lang === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
  }, [lang, dir])

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setLangState(lng)
    }
    i18n.on('languageChanged', handleLanguageChanged)
    return () => {
      i18n.off('languageChanged', handleLanguageChanged)
    }
  }, [i18n])

  const setLang = (newLang: string) => {
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
