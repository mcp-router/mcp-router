/** @type {import('tailwindcss').Config} */
const sharedConfig = require("@mcp-router/tailwind-config/tailwind.config.js");

module.exports = {
  presets: [sharedConfig],
  content: [
    "./src/**/*.{js,jsx,ts,tsx,html}",
    "../../packages/frontend/src/**/*.{js,jsx,ts,tsx}",
    // Include content from the frontend package
    "../../packages/frontend/dist/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};