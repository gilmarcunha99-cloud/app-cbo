/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,jsx,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta de obra: grafite + laranja/âmbar de sinalização.
        obra: {
          50: '#FFF8EB', 100: '#FEEBC8', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        },
        grafite: {
          50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8',
          500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1F2937', 900: '#111827', 950: '#0B0F17',
        },
      },
      fontFamily: { sans: ['Inter', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
