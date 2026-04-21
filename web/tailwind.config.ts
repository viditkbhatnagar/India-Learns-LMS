import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-orange': '#F58220',
        'brand-navy': '#1A3A8F',
        'brand-sky': '#6E9BCC',
        'brand-cream': '#FBF5E8',
        ink: '#0F1A2E',
        muted: '#6B7280',
        success: '#15803D',
        warning: '#B45309',
        danger: '#B91C1C',
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '12px',
      },
    },
  },
  plugins: [],
};

export default config;
