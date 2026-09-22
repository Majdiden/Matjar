import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  const menuRef = useRef<HTMLDivElement>(null)
  // Horizontal nudge, in px, that keeps the panel inside the viewport.
  const [shift, setShift] = useState(0)

  // The panel is anchored to the trigger with `end-0`, which is right for a
  // trigger sitting at the inline-end of its row (headers) but pushes the
  // panel off-screen when the trigger sits at the inline-start — notably the
  // mobile drawer in RTL, where `end-0` resolves to `left:0` and the 11rem
  // panel runs past the right edge. Themes place this component in several
  // spots, so rather than have each guess an anchor, measure once per open
  // and shift the panel back inside.
  useLayoutEffect(() => {
    if (!open) { setShift(0); return }
    const el = menuRef.current
    if (!el) return
    const measure = () => {
      // Read the untranslated position so the correction never compounds.
      const prev = el.style.transform
      el.style.transform = ''
      const r = el.getBoundingClientRect()
      el.style.transform = prev
      const M = 8 // keep a small gutter from the screen edge
      let dx = 0
      if (r.right > window.innerWidth - M) dx = window.innerWidth - M - r.right
      if (r.left + dx < M) dx = M - r.left
      setShift(dx)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

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
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--radius-pill,9999px)] border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary,#2563eb)]"
        style={{ borderColor: 'color-mix(in srgb, currentColor 25%, transparent)' }}
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
          ref={menuRef}
          role="menu"
          className={`absolute end-0 ${openUp ? 'bottom-full mb-2' : 'top-full mt-2'} min-w-[11rem] max-w-[calc(100vw-1rem)] rounded-2xl border shadow-xl z-50 p-1.5 text-sm overflow-hidden`}
          style={{
            backgroundColor: 'var(--color-background, #ffffff)',
            borderColor: 'var(--color-border, #e5e7eb)',
            transform: shift ? `translateX(${shift}px)` : undefined,
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
