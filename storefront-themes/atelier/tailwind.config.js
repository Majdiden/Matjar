const rtl = require('tailwindcss-rtl');
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../_shared/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #1c1c1c)',
        secondary: 'var(--color-secondary, #b6713e)',
        accent: 'var(--color-accent, #f5f1eb)',
        ink: 'var(--color-foreground, #1c1c1c)',
        bronze: 'var(--atelier-bronze, #b6713e)',
        'bronze-ink': 'var(--atelier-bronze-ink, #8a4f24)',
        sale: 'var(--atelier-sale, #c81e1e)',
      },
      fontFamily: {
        display: ['var(--font-family-heading)', 'Fraunces', 'Georgia', 'serif'],
        body: ['var(--font-family)', 'DM Sans', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['var(--fs-xs, 0.75rem)', { lineHeight: 'var(--lh-xs, 1rem)' }],
        sm: ['var(--fs-sm, 0.875rem)', { lineHeight: 'var(--lh-sm, 1.25rem)' }],
        base: ['var(--fs-base, 1rem)', { lineHeight: 'var(--lh-base, 1.5rem)' }],
        lg: ['var(--fs-lg, 1.125rem)', { lineHeight: 'var(--lh-lg, 1.75rem)' }],
      },
      transitionTimingFunction: {
        hero: 'cubic-bezier(.87,.03,.41,.9)',
      },
    },
  },
  plugins: [rtl],
};
