/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FDF7F3',
          100: '#FBECE3',
          200: '#F6D5C3',
          300: '#EEB599',
          400: '#E48A63',
          500: '#D76231',
          600: '#B84A1C', // primary brand tone
          700: '#943715',
          800: '#7A2E14',
          900: '#642814',
          950: '#391207',
        },
        accent: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706', // warm festive gold
          700: '#B45309',
        },
        store: {
          bg: '#FAF8F5',
          surface: '#FFFFFF',
          card: '#FFFFFF',
          border: '#EFECE6',
          dark: '#1C1917',
          muted: '#78716C',
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px -2px rgba(184, 74, 28, 0.05), 0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 10px 30px -4px rgba(184, 74, 28, 0.08), 0 6px 16px -2px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
