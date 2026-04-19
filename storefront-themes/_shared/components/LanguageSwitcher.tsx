import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'

interface Props {
  className?: string
}

export function LanguageSwitcher({ className = '' }: Props) {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const choose = (next: 'en' | 'ar') => {
    setLang(next)
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === 'ar' ? 'تغيير اللغة' : 'Change language'}
        className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium hover:opacity-70 transition-opacity"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 8h6M9 6v2c0 4-1 6-4 8" />
          <path d="M5 12c2 3 4 4 8 4" />
          <path d="m13 20 4-9 4 9" />
          <path d="M14.5 17h5" />
        </svg>
        <span className="uppercase">{lang === 'ar' ? 'AR' : 'EN'}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1 min-w-[8rem] rounded-md border border-gray-200 bg-white shadow-lg z-50 py-1 text-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('en')}
            className={`block w-full text-start px-3 py-1.5 hover:bg-gray-100 ${lang === 'en' ? 'font-semibold' : ''}`}
          >
            English
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('ar')}
            className={`block w-full text-start px-3 py-1.5 hover:bg-gray-100 ${lang === 'ar' ? 'font-semibold' : ''}`}
          >
            العربية
          </button>
        </div>
      )}
    </div>
  )
}
