---
status: complete
priority: p1
issue_id: "103"
tags: [code-review, security, xss]
dependencies: []
---

# Production CSP Includes unsafe-inline Weakening XSS Protection

The production Content Security Policy (CSP) includes `'unsafe-inline'` in the `default-src` directive. This allows inline styles and potentially inline event handlers, significantly weakening XSS protection. If an attacker can inject HTML content (e.g., through a malicious MCP server name or description), they can execute inline scripts.

## Problem Statement

In `main.ts` (lines 354-361), the production CSP is defined as:

```typescript
const PROD_CSP = `
  default-src 'self' 'unsafe-inline';
  script-src 'self';
  connect-src 'self' https://mcp-router.net https://api.mcp-router.net https://github.com;
  img-src 'self' data:;
`
```

While `script-src 'self'` correctly restricts script sources, the `default-src 'self' 'unsafe-inline'` acts as a fallback for directives not explicitly listed (`style-src`, `font-src`, `object-src`, etc.). This means:
- `style-src` falls back to `default-src`, allowing inline styles via `style` attributes
- Inline styles can be used as an XSS vector in combination with CSS injection techniques
- `object-src` falls back to `default-src`, which should ideally be `'none'`

The development CSP is even more permissive (expected), but the production CSP should be as restrictive as possible.

## Findings

**Production CSP definition (lines 354-361):**
```typescript
const PROD_CSP = `
  default-src 'self' 'unsafe-inline';
  script-src 'self';
  connect-src 'self' https://mcp-router.net https://api.mcp-router.net https://github.com;
  img-src 'self' data:;
`
```

**Development CSP (lines 345-352):**
```typescript
const DEV_CSP = `
  default-src 'self' 'unsafe-inline' http://localhost:* ws://localhost:*;
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  connect-src 'self' http://localhost:* ws://localhost:* ...;
  img-src 'self' data:;
`
```

**CSP application (lines 363-369):**
```typescript
const csp = isDevelopment() ? DEV_CSP : PROD_CSP;
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      "Content-Security-Policy": [csp],
```

**Attack vector:** MCP server names and descriptions are rendered in the UI. If a malicious server name contains HTML with inline style attributes, the current CSP permits their execution. While `script-src 'self'` blocks inline `<script>` tags, CSS-based attacks (data exfiltration via `url()`, UI redressing via overlays) remain possible.

**Locations:**
- `apps/electron/src/main.ts` lines 345-361

## Proposed Solutions

### Option 1: Remove unsafe-inline, add explicit style-src with nonces

**Approach:** Remove `'unsafe-inline'` from `default-src`. Add an explicit `style-src 'self' 'nonce-{random}'` directive using a per-session nonce. Update the renderer to include the nonce on legitimate `<style>` tags. Add `object-src 'none'` and `base-uri 'self'` for additional hardening.

**Pros:**
- Industry best practice for CSP
- Blocks all inline style injection
- Nonce system is well-supported in Electron

**Cons:**
- Requires nonce generation and injection into the HTML template
- Third-party CSS libraries using inline styles may break
- shadcn/ui components may use inline styles that need refactoring

**Effort:** 4-8 hours

**Risk:** Medium (potential UI breakage from inline styles in component libraries)

---

### Option 2: Remove unsafe-inline, use style hashes

**Approach:** Remove `'unsafe-inline'` from `default-src`. Identify all legitimate inline styles in the built application, compute their SHA-256 hashes, and add them to `style-src` as `'sha256-{hash}'` entries.

**Pros:**
- No runtime nonce generation needed
- Precise allowlisting of known inline styles
- Stronger than nonces for static content

**Cons:**
- Fragile -- any change to inline styles requires updating hashes
- Difficult to maintain with dynamic component libraries
- Build step needed to compute hashes

**Effort:** 6-12 hours

**Risk:** Medium-High (maintenance burden)

---

### Option 3: Move unsafe-inline to style-src only, harden default-src

**Approach:** Change `default-src` to `'self'` only. Add an explicit `style-src 'self' 'unsafe-inline'` to permit inline styles (pragmatic compromise). Add `object-src 'none'`, `base-uri 'self'`, and `frame-src 'none'` for defense in depth.

**Pros:**
- No UI breakage from inline styles
- Significantly improves CSP by hardening default-src
- Quick to implement
- `object-src 'none'` blocks plugin-based attacks

**Cons:**
- `style-src 'unsafe-inline'` still permits CSS injection
- Not as strong as nonce or hash-based approaches

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `apps/electron/src/main.ts` lines 345-361

**Related components:**
- Electron main process (session CSP headers)
- Renderer process (all UI components)
- shadcn/ui component library (may use inline styles)

## Acceptance Criteria

- [ ] Production CSP `default-src` does not include `'unsafe-inline'`
- [ ] `object-src 'none'` is present in production CSP
- [ ] `base-uri 'self'` is present in production CSP
- [ ] Application renders correctly with the updated CSP (no visual regressions)
- [ ] Inline style injection in server names/descriptions is blocked by CSP
- [ ] CSP violation reports are logged (if report-uri or report-to is configured)

## Work Log

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
