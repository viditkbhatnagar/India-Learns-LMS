import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand scales — anchor 500 matches the logo JPEG exactly; surrounding
        // steps are regenerated in OKLCH for perceptually uniform jumps.
        // Chroma is reduced at 50/100 and 800/900 per the "reduce chroma near
        // white/black" rule so pale tints don't look bruised and dark tones
        // don't look muddy.
        navy: {
          50: 'oklch(0.958 0.018 265)',
          100: 'oklch(0.886 0.045 265)',
          200: 'oklch(0.767 0.080 265)',
          300: 'oklch(0.630 0.115 265)',
          400: 'oklch(0.498 0.135 265)',
          500: '#1A3A8F',
          600: 'oklch(0.328 0.127 266)',
          700: 'oklch(0.275 0.105 266)',
          800: 'oklch(0.222 0.083 266)',
          900: 'oklch(0.172 0.058 265)',
        },
        orange: {
          50: 'oklch(0.970 0.025 72)',
          100: 'oklch(0.920 0.058 72)',
          200: 'oklch(0.834 0.115 65)',
          300: 'oklch(0.773 0.157 55)',
          400: 'oklch(0.738 0.170 50)',
          500: '#F58220',
          600: 'oklch(0.638 0.163 46)',
          700: 'oklch(0.525 0.148 43)',
          800: 'oklch(0.413 0.118 40)',
          900: 'oklch(0.303 0.087 37)',
        },
        // Aliases for backward compat with existing components.
        'brand-orange': '#F58220',
        'brand-navy': '#1A3A8F',
        'brand-sky': '#6E9BCC',
        'brand-cream': '#FBF5E8',
        // Neutrals — ink already navy-tinted (not pure black). `muted` sits on
        // the slate scale which is close enough to navy-tinted. `surface` now
        // carries a barely-perceptible warm tint toward the cream bg so white
        // cards feel grounded rather than floating.
        ink: '#0F1A2E',
        muted: '#64748B',
        surface: {
          DEFAULT: 'oklch(0.992 0.005 80)',
          alt: '#FBF5E8',
          muted: '#F3EFE3',
        },
        success: '#15803D',
        warning: '#B45309',
        danger: '#B91C1C',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Display ramp for hero headings.
        'display-sm': ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '700' }],
        'display-md': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-lg': ['3rem', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '700' }],
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        // Elevation scale — all tuned for cream background.
        'elev-1': '0 1px 2px 0 rgb(15 26 46 / 0.04), 0 1px 3px 0 rgb(15 26 46 / 0.06)',
        'elev-2': '0 4px 8px -2px rgb(15 26 46 / 0.06), 0 2px 4px -2px rgb(15 26 46 / 0.04)',
        'elev-3': '0 12px 24px -6px rgb(15 26 46 / 0.08), 0 4px 8px -4px rgb(15 26 46 / 0.05)',
        'elev-4': '0 24px 48px -12px rgb(15 26 46 / 0.14), 0 8px 16px -8px rgb(15 26 46 / 0.06)',
        'glow-orange': '0 6px 20px -6px rgb(245 130 32 / 0.45)',
        'glow-navy': '0 6px 20px -6px rgb(26 58 143 / 0.35)',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(1200px 600px at 80% -10%, rgb(245 130 32 / 0.12), transparent 50%), radial-gradient(900px 500px at 10% 110%, rgb(26 58 143 / 0.12), transparent 55%)',
        'brand-gradient':
          'linear-gradient(135deg, #1A3A8F 0%, #2A4FA8 35%, #6E9BCC 100%)',
        'accent-gradient': 'linear-gradient(135deg, #F58220 0%, #FA8B2F 50%, #FFA04E 100%)',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-500px 0' },
          '100%': { backgroundPosition: '500px 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 220ms ease-out',
        'scale-in': 'scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-in-right': 'slide-in-right 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      transitionTimingFunction: {
        // ease-out-quint: smooth deceleration, no overshoot. Use for entrances,
        // hover lifts, drawer slides. Named "decel" so nobody mistakes the curve
        // for an actual bounce.
        decel: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
