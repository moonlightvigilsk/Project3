/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#FDFCF9',
          100: '#FAF8F5',
          200: '#F2EFE9',
          300: '#E8E3DA',
        },
        ink: {
          900: '#1C1917',
          800: '#292524',
          700: '#44403C',
          500: '#78716C',
          400: '#A8A29E',
        },
        stone: {
          border: '#E7E5E4',
          subtle: '#F5F5F4',
        },
        french: {
          navy: '#1E293B',
          bordeaux: '#800020',
          ochre: '#854D0E',
        }
      },
      fontFamily: {
        serif: ['Lora', '"Noto Serif"', 'Georgia', 'Cambria', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
