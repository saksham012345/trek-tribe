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
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09'
        },
        earth: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03'
        }
      },
      backgroundImage: {
        'forest-gradient': 'linear-gradient(135deg, #020617 0%, #0f172a 25%, #1e293b 50%, #334155 75%, #475569 100%)',
        'nature-gradient': 'linear-gradient(135deg, #020617 0%, #0f172a 25%, #1e293b 50%, #334155 75%, #475569 100%)',
        'sunset-gradient': 'linear-gradient(135deg, #f97316 0%, #ea580c 25%, #dc2626 50%, #b91c1c 75%, #991b1b 100%)'
      },
      backdropBlur: {
        xs: '4px',
        glass: '20px',
        heavy: '40px'
      },
      borderRadius: {
        glass: '24px',
        'glass-sm': '16px'
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(20, 83, 45, 0.06)',
        'elevation-2': '0 4px 16px rgba(20, 83, 45, 0.08)',
        'elevation-3': '0 12px 32px rgba(20, 83, 45, 0.12)',
        'elevation-4': '0 24px 64px rgba(20, 83, 45, 0.16)',
        'glass': '0 8px 32px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
        'glass-dark': '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glow-forest': '0 0 0 1px rgba(34, 197, 94, 0.15), 0 8px 24px rgba(34, 197, 94, 0.25)',
        'glow-earth': '0 0 0 1px rgba(217, 119, 6, 0.15), 0 8px 24px rgba(217, 119, 6, 0.25)'
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
        'rise-in': 'riseIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite'
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        riseIn: {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' }
        }
      }
    },
  },
  plugins: [],
}
