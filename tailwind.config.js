/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        eco: {
          50: '#e6f4ed',
          100: '#d0ece0',
          200: '#a3dfc7',
          300: '#72c9a8',
          400: '#3fb950',
          500: '#2ea043',
          600: '#238636',
          700: '#196c2e',
          800: '#125427',
          900: '#0d3d1d',
          950: '#092d16',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
