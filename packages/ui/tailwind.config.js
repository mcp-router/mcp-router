const sharedConfig = require('@mcp-router/tailwind-config/tailwind.config.js');

module.exports = {
  ...sharedConfig,
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
};
