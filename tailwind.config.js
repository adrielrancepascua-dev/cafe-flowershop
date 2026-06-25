/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          beige: '#EFE6DD',
          brown: '#5D4037',
          cream: '#F9F7F2',
          light: '#F9F7F2', // Alias for backward compatibility
          accent: '#A1887F',
          dark: '#3E2723',
          muted: '#D7CCC8',
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Lato"', 'sans-serif'],
      },
      boxShadow: {
        flower: '0 1px 3px rgba(62,39,35,0.06), 0 8px 24px rgba(62,39,35,0.04)',
        'flower-lg': '0 4px 12px rgba(62,39,35,0.08), 0 16px 40px rgba(62,39,35,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
