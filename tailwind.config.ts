import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#0B1F4B',
        gold:    '#C9A84C',
        blue:    '#1A5CB5',
        light:   '#EFF4FB',
        mid:     '#D0DCF0',
        subtext: '#4A5568',
        body:    '#1C1C2E',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
