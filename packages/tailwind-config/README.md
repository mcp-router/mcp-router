# @mcp-router/tailwind-config

Shared Tailwind CSS configuration for the MCP Router monorepo.

## Usage

### For Tailwind CSS v4 (recommended)

In your CSS file:

```css
/* Import the shared theme */
@import "@mcp-router/tailwind-config/theme.css";

/* Add any additional app-specific styles */
```

### For Tailwind CSS v3

In your `tailwind.config.js`:

```js
module.exports = {
  presets: [require("@mcp-router/tailwind-config/tailwind.config.js")],
  content: [
    // Your app's content paths
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Any app-specific overrides
};
```

### Accessing theme values programmatically

```js
const { colors, radius } = require("@mcp-router/tailwind-config");

// Use in your JavaScript/TypeScript code
console.log(colors.light.primary); // 'oklch(0.205 0 0)'
console.log(colors.dark.primary); // 'oklch(0.985 0 0)'
```

### Generating CSS programmatically

```js
const { generateThemeCSS } = require("@mcp-router/tailwind-config");

// Generate the complete theme CSS
const themeCSS = generateThemeCSS();
```

## Theme Structure

The theme includes:

- **Colors**: A comprehensive color palette using OKLCH color space

  - Light and dark mode variants
  - Semantic color names (background, foreground, primary, etc.)
  - Chart colors (chart-1 through chart-5)
  - Sidebar-specific colors

- **Border Radius**: Consistent radius values

  - Default: 0.625rem
  - Variants: sm, md, lg, xl

- **Animations**: Accordion animations for UI components
