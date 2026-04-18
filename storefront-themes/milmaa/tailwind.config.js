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
        primary: 'var(--color-primary, #5eaaa8)',
        secondary: 'var(--color-secondary, #2c4a4a)',
        accent: 'var(--color-accent, #f7c1b7)',
      },
      fontFamily: {
        sans: ['var(--font-app)', 'Fraunces', 'Georgia', 'serif'],
        heading: ['Fraunces', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [rtl],
};
