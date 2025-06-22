/**
 * Tailwind CSS v3 configuration
 * This file is for packages that still use Tailwind CSS v3
 */

const sharedConfig = require('./src/index.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,jsx,ts,tsx,html}',
    './index.html',
  ],
  theme: {
    extend: {
      colors: sharedConfig.theme.extend.colors,
      borderRadius: sharedConfig.theme.extend.borderRadius,
      keyframes: sharedConfig.theme.extend.keyframes,
      animation: sharedConfig.theme.extend.animation,
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
};