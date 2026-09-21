const rtl = require('tailwindcss-rtl');
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../_shared/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--color-background, #fcf7ee)',
        sand: 'var(--color-accent, #ecdec1)',
        ink: 'var(--color-foreground, #0f0f0f)',
        bronze: 'var(--color-primary, #8f5426)',
        clay: 'var(--linen-bronze-deep, #6f3f18)',
        dune: 'var(--color-muted, #5f5a52)',
        line: 'var(--color-border, #e6dccb)',
        tint: '#f6eedd',
        'tint-strong': '#f2e6cf',
      },
      fontFamily: {
        heading: ['var(--font-family-heading)', 'Urbanist', 'system-ui', 'sans-serif'],
        body: ['var(--font-family)', '"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['var(--fs-xs, 0.75rem)', { lineHeight: 'var(--lh-xs, 1.1rem)' }],
        sm: ['var(--fs-sm, 0.875rem)', { lineHeight: 'var(--lh-sm, 1.35rem)' }],
        base: ['var(--fs-base, 1.0625rem)', { lineHeight: 'var(--lh-base, 1.7rem)' }],
        lg: ['var(--fs-lg, 1.1875rem)', { lineHeight: 'var(--lh-lg, 1.8rem)' }],
      },
      letterSpacing: { eyebrow: '0.18em' },
      transitionDuration: { short: '100ms', DEFAULT: '300ms', long: '500ms' },
    },
  },
  plugins: [rtl],
};
