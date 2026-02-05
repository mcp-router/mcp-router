/**
 * SVG Sanitizer utility to prevent XSS attacks when rendering SVG content.
 *
 * This sanitizer removes:
 * - <script> tags and their contents
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - javascript: URLs in href/xlink:href attributes
 * - data: URLs that could contain scripts
 * - Foreign object elements that could contain HTML
 *
 * WARNING: Known bypass risks with regex-based SVG sanitization:
 * - HTML entity encoding (e.g., &#106;avascript:) can bypass URL scheme checks
 * - CDATA sections can hide script content from regex patterns
 * - Parser differentials between regex and browser SVG parsers (e.g., null bytes,
 *   unusual whitespace, or encoding tricks that regex misses but browsers parse)
 * - Nested/malformed tags that confuse regex matching but render in browsers
 *
 * TODO: Replace with DOMPurify (a DOM-based sanitizer) for robust protection.
 * DOMPurify parses SVG the same way browsers do, eliminating parser differential
 * attacks. See: https://github.com/cure53/DOMPurify
 */

// List of dangerous event handler attributes to remove
const EVENT_HANDLER_REGEX = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

// Dangerous URL schemes
const DANGEROUS_URL_REGEX =
  /(href|xlink:href)\s*=\s*["']?\s*(javascript:|data:text\/html|data:application)/gi;

// Script tags (including contents)
const SCRIPT_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;

// Foreign object elements (can contain arbitrary HTML)
const FOREIGN_OBJECT_REGEX =
  /<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi;

// Use element with dangerous external references
const DANGEROUS_USE_REGEX =
  /<use\b[^>]*\s(?:href|xlink:href)\s*=\s*["']?\s*(?!#)[^"'\s>]*/gi;

// Style elements that could contain expressions
const STYLE_EXPRESSION_REGEX = /expression\s*\(/gi;

// SVG animate elements that could be abused (onbegin, onend, etc. handlers)
const ANIMATE_EVENT_REGEX =
  /<(?:animate|animateMotion|animateTransform|set)\b[^>]*\s*on\w+\s*=/gi;

/**
 * Sanitizes SVG content to prevent XSS attacks.
 *
 * @param svgContent - The raw SVG string to sanitize
 * @returns Sanitized SVG string safe for rendering, or empty string if invalid
 */
export function sanitizeSvg(svgContent: string): string {
  if (!svgContent || typeof svgContent !== "string") {
    return "";
  }

  // Check if it's actually an SVG
  if (!svgContent.includes("<svg")) {
    return "";
  }

  let sanitized = svgContent;

  // Remove script tags and their contents
  sanitized = sanitized.replace(SCRIPT_TAG_REGEX, "");

  // Remove foreignObject elements
  sanitized = sanitized.replace(FOREIGN_OBJECT_REGEX, "");

  // Remove event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");

  // Remove dangerous URLs (javascript:, data:text/html, etc.)
  sanitized = sanitized.replace(DANGEROUS_URL_REGEX, '$1=""');

  // Remove dangerous use elements with external references
  sanitized = sanitized.replace(DANGEROUS_USE_REGEX, "<use");

  // Remove CSS expressions
  sanitized = sanitized.replace(STYLE_EXPRESSION_REGEX, "blocked(");

  // Check for animate elements with event handlers and remove those handlers
  // This is a secondary pass to catch any remaining event handlers on animation elements
  if (ANIMATE_EVENT_REGEX.test(sanitized)) {
    // Reset regex state
    ANIMATE_EVENT_REGEX.lastIndex = 0;
    sanitized = sanitized.replace(EVENT_HANDLER_REGEX, "");
  }

  return sanitized;
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

  // Inject styles into the SVG element
  if (sanitized.includes('style="')) {
    // Replace existing style
    return sanitized.replace(/style="[^"]*"/, `style="${styles}"`);
  } else {
    // Add new style
    return sanitized.replace(/<svg/, `<svg style="${styles}"`);
  }
}

export default sanitizeSvg;
