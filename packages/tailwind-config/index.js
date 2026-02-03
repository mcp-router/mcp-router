/**
 * Shared Tailwind CSS configuration for MCP Router
 * This configuration defines the theme values used across the monorepo
 */

// Color palette using OKLCH color space
const colors = {
  // Light mode colors
  light: {
    background: "oklch(0.99 0 0)",
    foreground: "oklch(0.25 0 0)",
    card: "oklch(1 0 0)",
    "card-foreground": "oklch(0.25 0 0)",
    popover: "oklch(1 0 0)",
    "popover-foreground": "oklch(0.25 0 0)",
    primary: "oklch(0.35 0.02 240)",
    "primary-foreground": "oklch(0.99 0 0)",
    secondary: "oklch(0.97 0.01 240)",
    "secondary-foreground": "oklch(0.35 0.02 240)",
    muted: "oklch(0.97 0.01 240)",
    "muted-foreground": "oklch(0.55 0.01 240)",
    accent: "oklch(0.97 0.01 240)",
    "accent-foreground": "oklch(0.35 0.02 240)",
    destructive: "oklch(0.6 0.18 25)",
    "destructive-foreground": "oklch(0.99 0 0)",
    border: "oklch(0.93 0.01 240)",
    input: "oklch(0.93 0.01 240)",
    ring: "oklch(0.8 0.02 240)",
    "chart-1": "oklch(0.646 0.222 41.116)",
    "chart-2": "oklch(0.6 0.118 184.704)",
    "chart-3": "oklch(0.398 0.07 227.392)",
    "chart-4": "oklch(0.828 0.189 84.429)",
    "chart-5": "oklch(0.769 0.188 70.08)",
    sidebar: "oklch(0.98 0.005 240)",
    "sidebar-foreground": "oklch(0.55 0.01 240)",
    "sidebar-primary": "oklch(0.35 0.02 240)",
    "sidebar-primary-foreground": "oklch(0.99 0 0)",
    "sidebar-accent": "oklch(0.96 0.01 240)",
    "sidebar-accent-foreground": "oklch(0.35 0.02 240)",
    "sidebar-border": "oklch(0.95 0.01 240)",
    "sidebar-ring": "oklch(0.8 0.02 240)",
  },
  // Dark mode colors
  dark: {
    background: "oklch(0.18 0 0)",
    foreground: "oklch(0.95 0 0)",
    card: "oklch(0.22 0.01 240)",
    "card-foreground": "oklch(0.95 0 0)",
    popover: "oklch(0.22 0.01 240)",
    "popover-foreground": "oklch(0.95 0 0)",
    primary: "oklch(0.95 0 0)",
    "primary-foreground": "oklch(0.22 0.01 240)",
    secondary: "oklch(0.28 0.02 240)",
    "secondary-foreground": "oklch(0.95 0 0)",
    muted: "oklch(0.28 0.02 240)",
    "muted-foreground": "oklch(0.7 0.01 240)",
    accent: "oklch(0.28 0.02 240)",
    "accent-foreground": "oklch(0.95 0 0)",
    destructive: "oklch(0.6 0.18 25)",
    "destructive-foreground": "oklch(0.95 0 0)",
    border: "oklch(0.28 0.02 240)",
    input: "oklch(0.28 0.02 240)",
    ring: "oklch(0.45 0.02 240)",
    "chart-1": "oklch(0.488 0.243 264.376)",
    "chart-2": "oklch(0.696 0.17 162.48)",
    "chart-3": "oklch(0.769 0.188 70.08)",
    "chart-4": "oklch(0.627 0.265 303.9)",
    "chart-5": "oklch(0.645 0.246 16.439)",
    sidebar: "oklch(0.19 0.01 240)",
    "sidebar-foreground": "oklch(0.6 0.01 240)",
    "sidebar-primary": "oklch(0.488 0.243 264.376)",
    "sidebar-primary-foreground": "oklch(0.95 0 0)",
    "sidebar-accent": "oklch(0.22 0.01 240)",
    "sidebar-accent-foreground": "oklch(0.85 0.01 240)",
    "sidebar-border": "oklch(0.2 0.01 240)",
    "sidebar-ring": "oklch(0.45 0.02 240)",
  },
};

// Border radius values
const radius = {
  DEFAULT: "1rem",
  sm: "calc(1rem - 4px)",
  md: "calc(1rem - 2px)",
  lg: "1rem",
  xl: "calc(1rem + 4px)",
  "2xl": "1.5rem",
};

// Generate CSS variables for a given color scheme
function generateCSSVariables(colorScheme, prefix = "") {
  let css = "";
  for (const [key, value] of Object.entries(colorScheme)) {
    css += `  --${prefix}${key}: ${value};\n`;
  }
  return css;
}

// Generate the complete CSS with variables
function generateThemeCSS() {
  return `@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
${generateCSSVariables(colors.light)}
  --radius: ${radius.DEFAULT};
}

.dark {
${generateCSSVariables(colors.dark)}
}

@theme inline {
${Object.entries(colors.light)
  .map(([key]) => `  --color-${key}: var(--${key});`)
  .join("\n")}
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`;
}

// Export configuration
module.exports = {
  colors,
  radius,
  generateCSSVariables,
  generateThemeCSS,
  // For Tailwind v3 compatibility (if needed in other packages)
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(
          Object.entries(colors.light).map(([key, value]) => [key, value]),
        ),
        // Add dark mode colors with dark: prefix
        dark: colors.dark,
      },
      borderRadius: radius,
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
};
