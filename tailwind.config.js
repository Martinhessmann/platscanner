/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        orokin: {
          gold: '#E5C100',
          light: '#FFF8D6',
          dark: '#A48A00',
        },
        tenno: {
          blue: '#00A9CE',
          light: '#B3E5F2',
          dark: '#006A82',
        },
        corpus: {
          green: '#00CE9B',
          light: '#B3F2E1',
          dark: '#008262',
        },
        grineer: {
          red: '#CE3200',
          light: '#F2C4B3',
          dark: '#821F00',
        },
        void: {
          purple: '#9B00CE',
          light: '#E1B3F2',
          dark: '#620082',
        },
        background: {
          dark: '#0D1117',
          light: '#161B22',
          card: '#21262D',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      },
    },
  },
  plugins: [],
};