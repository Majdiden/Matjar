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
        primary: 'var(--color-primary, #667eea)',
        secondary: 'var(--color-secondary, #764ba2)',
        accent: 'var(--color-accent, #f093fb)',
      },
      fontFamily: {
        sans: ["Nunito", "system-ui", "sans-serif"],
        heading: ["Quicksand", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
