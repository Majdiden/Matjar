const rtl = require('tailwindcss-rtl');
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../_shared/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #d4a8b3)',
        secondary: 'var(--color-secondary, #1d1d3b)',
        accent: 'var(--color-accent, #f8e4e4)',
      },
      fontFamily: {
        sans: ['var(--font-app)', 'Playfair Display', 'Georgia', 'serif'],
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
      // Body/label sizes resolve through CSS vars so Arabic (Tajawal renders
      // visually small) can bump them one step in index.css without touching
      // Latin sizes; responsive variants (sm:text-sm ...) keep working.
      fontSize: {
        xs: ['var(--fs-xs, 0.75rem)', { lineHeight: 'var(--lh-xs, 1rem)' }],
        sm: ['var(--fs-sm, 0.875rem)', { lineHeight: 'var(--lh-sm, 1.25rem)' }],
        base: ['var(--fs-base, 1rem)', { lineHeight: 'var(--lh-base, 1.5rem)' }],
        lg: ['var(--fs-lg, 1.125rem)', { lineHeight: 'var(--lh-lg, 1.75rem)' }],
      },
    },
  },
  plugins: [rtl],
};
