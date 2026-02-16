/**
 * SVG Sanitizer utility to prevent XSS attacks when rendering SVG content.
 *
 * Uses DOMPurify for robust, DOM-based sanitization that eliminates the parser
 * differential attacks possible with regex-based approaches. DOMPurify parses
 * SVG the same way browsers do, handling entity encoding, CDATA sections,
 * null bytes, and malformed tags correctly.
 *
 * See: https://github.com/cure53/DOMPurify
 */

import DOMPurify from "dompurify";

/**
 * Sanitizes SVG content to prevent XSS attacks.
 *
 * @param svgContent - The raw SVG string to sanitize
 * @returns Sanitized SVG string safe for rendering, or empty string if invalid
 */
function sanitizeSvg(svgContent: string): string {
  if (!svgContent || typeof svgContent !== "string") {
    return "";
  }

  if (!svgContent.includes("<svg")) {
    return "";
  }

  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Allow style attribute for inline styling of SVG elements
    ADD_ATTR: ["style"],
  });
}

/**
 * Sanitizes SVG content and applies custom styles.
 * This is a convenience wrapper that combines sanitization with style injection.
 *
 * @param svgContent - The raw SVG string to sanitize
 * @param styles - CSS styles to inject into the SVG element
 * @returns Sanitized SVG string with styles applied
 */
export function sanitizeSvgWithStyles(
  svgContent: string,
  styles: string,
): string {
  const sanitized = sanitizeSvg(svgContent);

  if (!sanitized) {
    return "";
  }

  // Inject styles into the SVG element after sanitization
  if (sanitized.includes('style="')) {
    // Replace existing style on the root SVG element
    return sanitized.replace(/style="[^"]*"/, `style="${styles}"`);
  } else {
    // Add new style attribute to the root SVG element
    return sanitized.replace(/<svg/, `<svg style="${styles}"`);
  }
}
