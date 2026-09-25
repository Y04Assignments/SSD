# AFTER-FIX EVIDENCE: V14 — OAuth Token in URL & Console Logging

## Vulnerability
**V14 — Transmission of JWT Bearer Tokens and User Profile PII via URL Query Parameters & Console Logging**  
**OWASP Category:** A02:2021 – Cryptographic Failures / A04:2021 – Insecure Design  
**CWE:** CWE-598: Use of GET Request Method with Sensitive Query Strings, CWE-532: Insertion of Sensitive Information into Log File

---

## Fix Applied
1. **Elimination of JWT and User Data from Redirect URLs:** In `backend/src/routes/auth.js`, removed all query parameters conveying bearer tokens (`token=...`) and user profile JSON (`user=...`) from the OAuth redirect URL.
2. **Short-Lived Authorization-Code Exchange Architecture:** Implemented a single-use, high-entropy authorization code pattern (`crypto.randomBytes(32).toString('hex')`) with a strict 60-second time-to-live (TTL). The backend redirect transmits only the opaque code:
   ```
   ${frontendUrl}/oauth/callback?code=${authCode}
   ```
3. **POST-Based Code Redemption Endpoint:** Added `POST /api/auth/exchange` where the frontend SPA submits the one-time code in an encrypted HTTP POST request body. Upon lookup, the code is immediately destroyed from memory to guarantee single-use redemption before returning the JWT session.
4. **Secure HttpOnly Cookie Option:** Configured `res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })` during OAuth callback processing.
5. **Eradication of Token Console Logging:** Removed `console.log('OAuthCallback: Logging in with token', token)` and `console.log('OAuthCallback: User data', parsedUser)` from `client/src/auth/OAuthCallback.jsx`, as well as token logging in `client/src/auth/EmailVerification.jsx`.
6. **Frontend Flow Adaptation:** Updated `client/src/auth/OAuthCallback.jsx` to consume `searchParams.get('code')`, invoke `POST /api/auth/exchange`, and route users according to their verified role (`/admin` for administrators, `/dashboard` for standard users).

---

## Source Changes
- `backend/src/routes/auth.js`: Added `oauthAuthCodes` single-use store, updated `/google/callback` to redirect with `code=${authCode}` and set `HttpOnly` cookie, added `POST /api/auth/exchange` redemption endpoint.
- `client/src/auth/OAuthCallback.jsx`: Replaced query string token parsing with POST code exchange to `/api/auth/exchange`; removed all `console.log` statements outputting tokens or user profiles.
- `client/src/auth/EmailVerification.jsx`: Removed `console.log('Attempting to verify token:', token)`.
- `backend/__tests__/authExchange.test.js`: Added unit tests verifying code exchange, single-use invalidation, expiration handling, and error validation.

---

## Verification & Retest Results

### Runtime Verification Limitation Notice
> **IMPORTANT:** Live Google OAuth runtime verification remains blocked because Google OAuth credentials (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`) are not configured in the clean local test environment. Verification was executed via static code analysis across backend and frontend repositories, combined with automated integration testing of the authorization code exchange mechanism.

### 1. Static Verification of Redirect Construction
Scanned `backend/src/routes/auth.js`:
```javascript
// Secure redirect: NEVER contains token or user JSON in URL
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
res.redirect(`${frontendUrl}/oauth/callback?code=${authCode}`);
```
*Result:* Zero bearer tokens or serialized JSON objects exist in redirect URLs.

### 2. Static Verification of Token Console Logging
Scanned entire codebase for token logging:
```bash
git grep -i "token=" backend/ client/
# Result: 0 matches

git grep "console.log.*token" backend/ client/
# Result: 0 matches
```
*Result:* All raw token console logging statements have been eliminated.

### 3. Automated Code Exchange Test Execution
Ran `jest __tests__/authExchange.test.js`:
```
PASS __tests__/authExchange.test.js
  V14: OAuth Code Exchange & Token Protection Tests
    ✓ exchanges a valid authorization code for token and user (14 ms)
    ✓ enforces single-use consumption: redeemed code cannot be reused (3 ms)
    ✓ rejects expired authorization codes (2 ms)
    ✓ rejects missing or invalid code parameter (2 ms)

Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

---

## Previous Vulnerable Behavior
The OAuth callback appended bearer JWT tokens and complete user profile JSON into the redirect URL query parameters, exposing them to browser history, proxy access logs, and HTTP `Referer` leakage. The frontend logged raw tokens directly to the browser developer console.

## Current Behavior
The redirect URL contains only an opaque, single-use, 60-second authorization code. The client exchanges this code via a secure HTTP POST request. Raw tokens are never placed in URLs or written to console logs.

## Expected Secure Behavior
Authentication tokens must never appear in URLs or browser console logs. SPAs requiring token handoffs must use short-lived authorization codes or secure HttpOnly cookies.

## Result
**PASS** (Verified via static analysis and automated unit testing; runtime OAuth remains blocked by environment)

---

## Regression Test
- Ran full backend test suite (`npm test`): 14 test suites, 78 tests passing.
- Verified standard email/password authentication and registration workflows continue to function normally.

---

## Commit
- **Commit Hash:** `6043b65`
- **Commit Message:** `fix(security): prevent OAuth token leakage through URLs and logs`
