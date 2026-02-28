/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7', // Brand Primary
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Semantic Premium Colors
        success: '#10b981', // Emerald 500
        warning: '#f59e0b', // Amber 500
        danger: '#ef4444', // Red 500
        info: '#3b82f6', // Blue 500
        dark: {
          900: '#0f172a', // Slate 900
          800: '#1e293b',
          50: '#f8fafc',
        },
        border: '#e5e7eb', // gray-200
      },
    },
  },
  plugins: [],
};
