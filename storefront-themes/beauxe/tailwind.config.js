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
        sans: ['Playfair Display', 'Georgia', 'serif'],
        heading: ['Playfair Display', 'Georgia', 'serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
