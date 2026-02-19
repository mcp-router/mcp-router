---
status: complete
priority: p2
issue_id: "111"
tags: [code-review, security]
dependencies: []
---

# shell.openExternal() Called Without URL Protocol Validation

`shell.openExternal(url)` is called without validating the URL protocol, allowing dangerous protocol handlers to be triggered.

## Problem Statement

In `main.ts` line 198, the `setWindowOpenHandler` callback passes any URL directly to `shell.openExternal()` without checking the protocol. This means:
1. A compromised renderer (via XSS or malicious content) could open `file://`, `smb://`, `ftp://`, or custom protocol handlers.
2. `file://` URLs can open local files or directories, potentially exposing sensitive data.
3. `smb://` URLs can trigger NTLM authentication to attacker-controlled servers on Windows.
4. Custom protocol handlers (`vscode://`, `x-callback://`, etc.) could trigger unintended actions.

Electron's own security documentation explicitly warns against calling `shell.openExternal` with untrusted URLs.

## Findings

- `apps/electron/src/main.ts` line 197-200:
  ```typescript
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  ```
- The URL comes from `window.open()` calls in the renderer process.
- No protocol validation is performed before the `shell.openExternal()` call.
- A second call exists in `apps/electron/src/main/modules/auth/auth.service.ts` line 93 (`shell.openExternal(authUrl.toString())`), but that one constructs the URL internally, so it is lower risk.

**Location:**
- `apps/electron/src/main.ts` line 198

## Proposed Solutions

### Option 1: Protocol allowlist (recommended)

**Approach:** Validate the URL protocol against an allowlist before calling `shell.openExternal()`:
```typescript
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      shell.openExternal(url);
    } else {
      logger.warn(`Blocked shell.openExternal for protocol: ${parsed.protocol}`);
    }
  } catch {
    logger.warn(`Blocked shell.openExternal for invalid URL: ${url}`);
  }
  return { action: "deny" };
});
```

**Pros:**
- Simple, auditable check
- Blocks all dangerous protocols
- Logs blocked attempts for debugging
- Handles malformed URLs gracefully

**Cons:**
- May block legitimate `mailto:` links if used in the renderer
- Need to decide which protocols to allow

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Protocol allowlist with configurable exceptions

**Approach:** Same as Option 1 but with a configurable array of allowed protocols (defaulting to `["https:", "http:"]`) that can be extended for specific needs like `mailto:`.

**Pros:**
- Flexible for future needs
- Still secure by default

**Cons:**
- Slightly more code
- Configuration adds a small attack surface

**Effort:** 1 hour

**Risk:** Low

---

### Option 3: Remove setWindowOpenHandler entirely

**Approach:** Do not open external URLs at all from renderer-initiated `window.open()`. Instead, handle external links through explicit IPC calls that include validation.

**Pros:**
- Most restrictive -- no external URL opening from renderer
- Forces all external navigation through a controlled path

**Cons:**
- May break existing UX flows where links open in the default browser
- More invasive refactor

**Effort:** 2-3 hours

**Risk:** Medium

## Technical Details

**Affected files:**
- `apps/electron/src/main.ts` line 198

**Related components:**
- Electron `shell.openExternal` API
- Renderer process (source of `window.open()` calls)
- Auth service (separate `shell.openExternal` call, lower risk)

## Acceptance Criteria

- [ ] `shell.openExternal()` only called with `http:` or `https:` URLs
- [ ] `file://`, `smb://`, `ftp://`, and custom protocols are blocked
- [ ] Blocked attempts are logged with the attempted protocol
- [ ] Malformed URLs do not throw unhandled exceptions
- [ ] Existing external link behavior (opening docs, GitHub, etc.) still works
- [ ] Auth flow (if it uses `setWindowOpenHandler`) still works

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Code Review

**Actions:**
- Identified unvalidated `shell.openExternal()` call in main.ts
- Confirmed no protocol filtering exists
- Reviewed Electron security guidelines on openExternal
- Identified secondary call in auth.service.ts (lower risk)

**Learnings:**
- Electron security checklist explicitly recommends validating URLs before `shell.openExternal`
- The `setWindowOpenHandler` is the correct place to intercept, but validation must be added

## Resources

### 2026-02-19 - Backlog Closure

**By:** Codex

**Disposition:** already-fixed

**Notes:** Verified the issue is already addressed in current main branch code; no additional patch required in this pass.
