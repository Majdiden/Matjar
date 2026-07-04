import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/LanguageProvider'

interface Props {
  className?: string
  /** Open the menu upward (for use near the bottom of the viewport, e.g. the
   *  slide-over menu footer) so the panel isn't clipped off-screen. */
  openUp?: boolean
}

export function LanguageSwitcher({ className = '', openUp = false }: Props) {
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
          className={`absolute end-0 ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'} min-w-[11rem] rounded-2xl border shadow-xl z-50 p-1.5 text-sm overflow-hidden`}
          style={{
            backgroundColor: 'var(--color-background, #ffffff)',
            borderColor: 'var(--color-border, #e5e7eb)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('en')}
            className={`flex w-full items-center justify-between text-start px-4 py-2.5 rounded-xl transition-colors hover:bg-black/[0.06] ${lang === 'en' ? 'font-semibold' : ''}`}
          >
            English
            {lang === 'en' && <span aria-hidden="true">✓</span>}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose('ar')}
            className={`flex w-full items-center justify-between text-start px-4 py-2.5 rounded-xl transition-colors hover:bg-black/[0.06] ${lang === 'ar' ? 'font-semibold' : ''}`}
          >
            العربية
            {lang === 'ar' && <span aria-hidden="true">✓</span>}
          </button>
        </div>
      )}
    </div>
  )
}
