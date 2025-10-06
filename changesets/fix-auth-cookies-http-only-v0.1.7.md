# Fix: Better Auth useSecureCookies for HTTP-Only Deployment

**Version:** v0.1.7+
**Date:** 2025-10-05
**Type:** Source Code Fix
**Status:** FIXED IN SOURCE (Production already has correct deployed code)

## Problem

The source code configured Better Auth to require secure cookies in production:

```typescript
advanced: {
  useSecureCookies: runtime.isProduction
}
```

This caused authentication cookies to require HTTPS, but the EscapePlan system runs on an isolated local network (10.10.10.0/24) using HTTP only (no TLS). In production, `runtime.isProduction` evaluates to `true` because the working directory is `/opt/escapeplan`, which would enable secure cookies and break authentication.

## Discovery

The deployed production code at `/opt/escapeplan/api/index.js` already had `useSecureCookies: false` (manually fixed by previous developer), but the source code in `apps/escapeplan-api/src/auth-config.ts` still had the problematic `runtime.isProduction` reference.

This discrepancy means the next package build would re-break authentication unless the source is fixed.

## Root Cause

**Incorrect Assumption:** The original code assumed production deployments would always use HTTPS.

**Reality:** EscapePlan is a Raspberry Pi appliance running on an isolated WiFi network without external internet access. There's no certificate authority, no public DNS, and no security benefit to using self-signed TLS certificates for browser-to-server communication on a trusted local network.

**Security Notes:**
- System accessed via mDNS (`escapeplan.local`) or IP (`10.10.10.1`)
- No external network access (offline-first design)
- Physical security model: trusted users on trusted WiFi
- HttpOnly cookies still protect against XSS
- SameSite=Lax prevents CSRF

## Files Changed

### Source Code
**File:** `apps/escapeplan-api/src/auth-config.ts`

**Change:** Line 163-166

**Before:**
```typescript
    advanced: {
      useSecureCookies: runtime.isProduction
    },
```

**After:**
```typescript
    advanced: {
      // HTTP-only (no TLS) for local network deployment - cookies work without HTTPS
      useSecureCookies: false
    },
```

### Production (Already Fixed)
**File:** `/opt/escapeplan/api/index.js` (deployed code)

**Current State:** Line 1038-1040 (in bundled code)
```javascript
    advanced: {
      useSecureCookies: false
    },
```

This was manually fixed on the production server. Our source code change ensures future builds will deploy with the correct configuration.

## Fix Rationale

### Why `false` is Correct for This Deployment

1. **Local Network Only:** No internet connectivity, no external threats
2. **No CA Available:** Cannot get valid TLS certificates for `escapeplan.local` or `10.10.10.1`
3. **Self-Signed Certs Worse:** Browser warnings, manual cert acceptance, poor UX
4. **HttpOnly Still Enforced:** Protects against XSS attacks
5. **SameSite Protection:** Prevents CSRF attacks
6. **Physical Security:** Access requires physical proximity to WiFi AP

### Why This Doesn't Compromise Security

**Cookies Are Still Protected:**
- `httpOnly: true` prevents JavaScript access
- `sameSite: 'lax'` prevents cross-site requests
- `path: '/'` scopes to entire application

**No New Attack Vectors:**
- Cannot intercept network traffic (isolated WiFi)
- Cannot perform man-in-the-middle (no upstream connection)
- HTTPS without valid certs adds no security, only UX friction

## Testing

### How to Verify Fix

1. **Build Fresh Package:**
   ```bash
   cd build-system
   ./build-deb.sh
   ```

2. **Extract and Inspect:**
   ```bash
   dpkg-deb -x escapeplan_*.deb /tmp/test-extract
   grep "useSecureCookies" /tmp/test-extract/opt/escapeplan/api/index.js
   ```

3. **Expected Output:**
   ```javascript
   useSecureCookies: false
   ```

4. **Test Authentication:**
   ```bash
   # Login via web UI
   # Check browser DevTools → Application → Cookies
   # Should see: better-auth.session_token (HttpOnly, SameSite=Lax)
   ```

### Manual Testing Steps

1. Navigate to `http://escapeplan.local/login`
2. Login with valid credentials
3. Open DevTools → Application → Cookies
4. Verify cookie is set:
   - Name: `better-auth.session_token`
   - Domain: `escapeplan.local` or `10.10.10.1`
   - HttpOnly: ✓
   - Secure: ✗ (should be unchecked - this is correct for HTTP)
   - SameSite: Lax

## Impact

**Before Fix:**
- ❌ Source code would break auth on next package rebuild
- ❌ Manual production fix would be overwritten
- ❌ Inconsistency between source and production

**After Fix:**
- ✅ Source code matches production behavior
- ✅ Future package builds will work correctly
- ✅ Authentication works on HTTP-only local network
- ✅ Cookies still protected by HttpOnly + SameSite

## Deployment Notes

**This fix applies to SOURCE CODE only.** The production server already has the correct configuration (manually fixed previously).

**Next steps:**
1. Commit this source change to git
2. Rebuild package with corrected source
3. Future deployments will have correct configuration

**Do NOT rebuild and deploy immediately** unless there are other critical fixes to include. The production server is already working correctly.

## Related Changes

This fix complements previous production fixes documented in:
- `fix-api-client-relative-path-v0.1.7.md`
- `fix-websocket-connection-url-v0.1.7.md`
- `fix-nginx-api-prefix-stripping-v0.1.7.md`
- `fix-nginx-websocket-proxy-v0.1.7.md`

## References

- Better Auth documentation: https://www.better-auth.com/docs/concepts/session-management
- Runtime detection: `packages/contracts/src/runtime.ts`
- Auth configuration: `apps/escapeplan-api/src/auth-config.ts`
- OWASP Cookie Security: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

## Future Considerations

If HTTPS is ever required (e.g., external access, compliance requirements):

1. Use Let's Encrypt with DNS challenge (requires internet)
2. Use self-signed cert with manual trust (poor UX)
3. Use mkcert for local development only
4. Keep HTTP for production appliance deployment (current approach)

**Recommended:** Keep HTTP for offline-first local network deployment. The security model is sound.
