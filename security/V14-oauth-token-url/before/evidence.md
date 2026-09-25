# BEFORE-FIX EVIDENCE: V14 — OAuth Token & User Data in URL Query String

**Vulnerability:** Transmission of JWT Bearer Tokens and User Profile PII via URL Query Parameters  
**OWASP Category:** A02:2021 – Cryptographic Failures / A04:2021 – Insecure Design  
**Affected Component:** `GET /api/auth/google/callback` and `client/src/auth/OAuthCallback.jsx`  
**Preconditions:** Google OAuth callback invocation  

---

## Vulnerability Description & Flow

1. In `backend/src/routes/auth.js:22-26`:
   ```javascript
   const token = jwt.sign(userData, process.env.JWT_SECRET, {
     expiresIn: process.env.JWT_EXPIRE || '30d',
   });
   const redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`;
   res.redirect(redirectUrl);
   ```
2. The minted JWT token and user profile JSON (including user ID, email, full name, and role) are appended directly to the URL query string as parameters (`?token=<JWT>&user=<JSON>`).
3. In `client/src/auth/OAuthCallback.jsx:20-21`:
   ```javascript
   const token = searchParams.get('token');
   const userData = searchParams.get('user');
   console.log('OAuthCallback: Logging in with token', token);
   console.log('OAuthCallback: User data', parsedUser);
   ```
4. **Security Vulnerabilities:**
   * **URL Token Leakage:** Query parameters in URLs are routinely recorded in plain text in browser history, reverse proxy access logs, web application firewall (WAF) logs, and transmitted in the HTTP `Referer` header to third-party assets or external links.
   * **Console Logging:** The frontend explicitly logs the raw JWT token and user profile data to the browser developer console via `console.log()`.

---

## Runtime Verification Status

* **Status:** **SOURCE CONFIRMED / RUNTIME BLOCKED**
* **Runtime Verification Execution:**
  As established under V05, the local development environment lacks active `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` credentials, which prevents triggering the live Google OAuth redirect at runtime.
* **Source-Level Confirmation:**
  The vulnerable redirect string construction is hardcoded in `backend/src/routes/auth.js:25`:
  ```
  redirectUrl = `${process.env.FRONTEND_URL}/oauth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userData))}`
  ```
  And the browser logging is hardcoded in `client/src/auth/OAuthCallback.jsx:20`:
  ```
  console.log('OAuthCallback: Logging in with token', token);
  ```

---

## Observed Result vs Expected Secure Result

* **Observed Code Result:** Tokens and user credentials are sent via GET query parameters in HTTP 302 redirects and written to browser console logs.
* **Expected Secure Result:** Authentication tokens should be transmitted in `Set-Cookie` headers with `HttpOnly`, `Secure`, and `SameSite` flags, or exchanged via a short-lived authorization code in an encrypted POST request. Tokens must never appear in URLs or browser console logs.

**Impact:** Bearer token theft through Referer header leaks, browser history inspection, intermediate proxy logs, or shoulder-surfing/console inspection.  
**Source Location:** `backend/src/routes/auth.js:22-26`, `client/src/auth/OAuthCallback.jsx:20-21`.  
**Runtime Verification:** **SOURCE CONFIRMED / RUNTIME BLOCKED**  
**Evidence Files:** `security/V14-oauth-token-url/before/evidence.md`
