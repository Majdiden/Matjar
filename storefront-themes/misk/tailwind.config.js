const rtl = require('tailwindcss-rtl');
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../_shared/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Customizer-bridged tokens (ThemeProvider injects --color-*).
        //
        // NOTE: these are bare `var()` values, so Tailwind CANNOT apply an
        // alpha modifier to them — `bg-ink/75` compiles to nothing at all
        // and fails silently, leaving the element with no background.
        // For translucency use an `opacity-*` utility on a dedicated
        // layer, or a literal `bg-black/40`, never `bg-<token>/<n>`.
        primary: 'var(--color-primary, #14110E)',
        secondary: 'var(--color-secondary, #A87333)',
        accent: 'var(--color-accent, #F4EFE7)',
        ink: 'var(--color-foreground, #14110E)',
        muted: 'var(--color-muted, #6E675E)',
        line: 'var(--color-border, #E6DFD4)',
        // Theme-owned surfaces. Still CSS vars so custom CSS can retune them.
        gold: 'var(--misk-gold, #A87333)',
        'gold-ink': 'var(--misk-gold-ink, #8A5C25)',
        sand: 'var(--misk-sand, #F4EFE7)',
        midnight: 'var(--misk-midnight, #191528)',
        grove: 'var(--misk-grove, #33361F)',
        sale: 'var(--misk-sale, #C2281F)',
      },
      fontFamily: {
        // Arabic first in both stacks; the Latin families are the fallback
        // branch and only win when the glyph is absent from Amiri/Tajawal.
        display: ['var(--font-family-heading)', 'Amiri', 'Cormorant Garamond', 'Georgia', 'serif'],
        body: ['var(--font-family)', 'Tajawal', 'Jost', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['var(--fs-xs, 0.8125rem)', { lineHeight: 'var(--lh-xs, 1.2rem)' }],
        sm: ['var(--fs-sm, 0.9375rem)', { lineHeight: 'var(--lh-sm, 1.5rem)' }],
        base: ['var(--fs-base, 1.0625rem)', { lineHeight: 'var(--lh-base, 1.85rem)' }],
        lg: ['var(--fs-lg, 1.1875rem)', { lineHeight: 'var(--lh-lg, 2rem)' }],
      },
      transitionTimingFunction: {
        misk: 'cubic-bezier(.2,.8,.2,1)',
      },
    },
  },
  plugins: [rtl],
};
