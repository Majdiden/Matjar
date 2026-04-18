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
        primary: 'var(--color-primary, #a3e635)',
        secondary: 'var(--color-secondary, #0a0a0a)',
        accent: 'var(--color-accent, #ff6a13)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Archivo Black', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
