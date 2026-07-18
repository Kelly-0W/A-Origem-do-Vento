/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Manrope', 'sans-serif'],
      },
      colors: {
        void: '#0a0908',
        panel: '#141210',
        'panel-border': 'rgba(255,255,255,0.08)',
        blood: {
          DEFAULT: '#7a1f1f',
          dark: '#4a1414',
          bright: '#a52a2a',
        },
        forest: {
          DEFAULT: '#1f3d2b',
          dark: '#122318',
        },
        gold: '#c9a227',
        mist: '#8b8880',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        flicker: {
          '0%, 100%': { opacity: 1 },
          '45%': { opacity: 0.85 },
          '50%': { opacity: 0.6 },
          '55%': { opacity: 0.9 },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
        flicker: 'flicker 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
