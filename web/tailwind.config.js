/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0fdf4',
          100: '#dcfce7', 
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16'
        },
        nature: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d', 
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          950: '#1a2e05'
        },
        earth: {
          50: '#fefdf8',
          100: '#fdf9eb',
          200: '#faf2d3',
          300: '#f6e7b0',
          400: '#f0d583',
          500: '#e9c46a',
          600: '#d4a853',
          700: '#b18946',
          800: '#8f6b3e',
          900: '#745834',
          950: '#3e2e1b'
        }
      },
      backgroundImage: {
        'forest-gradient': 'linear-gradient(135deg, #052e16 0%, #14532d 25%, #166534 50%, #15803d 75%, #16a34a 100%)',
        'nature-gradient': 'linear-gradient(135deg, #1a2e05 0%, #365314 25%, #3f6212 50%, #4d7c0f 75%, #65a30d 100%)',
        'sunset-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 25%, #dc2626 50%, #b91c1c 75%, #991b1b 100%)'
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        }
      }
    },
  },
  plugins: [],
}
