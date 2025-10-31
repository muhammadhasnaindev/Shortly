/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
          dark: '#059669',
        },
      },
      borderRadius: { '2xl': '1rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
