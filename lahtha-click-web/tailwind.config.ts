import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
        },
        paper: {
          50: 'rgb(var(--paper-50) / <alpha-value>)',
          100: 'rgb(var(--paper-100) / <alpha-value>)',
        },
        gold: {
          500: 'rgb(var(--gold-500) / <alpha-value>)',
          100: 'rgb(var(--gold-100) / <alpha-value>)',
        },
        coral: {
          500: 'rgb(var(--coral-500) / <alpha-value>)',
          100: 'rgb(var(--coral-100) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(11,20,55,0.05)',
        md: '0 4px 12px rgba(11,20,55,0.08)',
        lg: '0 12px 32px rgba(11,20,55,0.12)',
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: { 900: '#0B1437' },
        paper: { 50: '#FAFAFA' },
        gold: { 500: '#C8A95E' },
        coral: { 500: '#FF6B35' },
      },
      fontFamily: {
        sans: [
          '"IBM Plex Sans Arabic"',
          '"Inter"',
          'system-ui',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
}

export default config
