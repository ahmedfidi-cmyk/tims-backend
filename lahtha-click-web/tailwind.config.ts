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
}

export default config
