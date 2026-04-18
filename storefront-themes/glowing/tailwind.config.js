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
        primary: 'var(--color-primary, #111111)',
        secondary: 'var(--color-secondary, #6b6b6b)',
        accent: 'var(--color-accent, #f5e6d8)',
      },
      fontFamily: {
        sans: ['Cormorant Garamond', 'Georgia', 'serif'],
        heading: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
