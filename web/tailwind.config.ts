import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#b8d4fe',
          300: '#85b8fd',
          400: '#4d94f9',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554',
        },
        surface: {
          DEFAULT: '#0a0a1a',
          100: '#111125',
          200: '#1a1a35',
          300: '#242445',
        },
      },
    },
  },
  plugins: [],
};

export default config;
