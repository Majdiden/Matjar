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
        // Customizer-aware semantic tokens — track the manifest palette
        // via the CSS-var bridge in ThemeProvider.
        night: 'var(--color-background, #141414)',
        ink: 'var(--color-foreground, #f4f1ea)',
        mute: 'var(--color-muted, #a6a29a)',
        line: 'var(--color-border, #2b2b2b)',
        gold: 'var(--color-accent, #c8a24b)',
        // Semantic status colours — track the manifest palette so error/
        // success states stay on-brand instead of ad-hoc red/green utilities.
        error: 'var(--color-error, #e5484d)',
        success: 'var(--color-success, #5fae6e)',
        // Warm light-neutral product tile (image fallback backdrop).
        tile: '#e9e5de',
      },
      fontFamily: {
        sans: ['var(--font-app)', 'Jost', 'Tajawal', 'system-ui', 'sans-serif'],
        heading: ['Prata', 'Amiri', 'Georgia', 'serif'],
        body: ['Jost', 'Tajawal', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [rtl],
};
