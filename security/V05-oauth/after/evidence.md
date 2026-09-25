# AFTER-FIX EVIDENCE: V05 — Google OAuth Role Assignment & Account Linking

## Vulnerability
**V05 — Insecure Google OAuth Role Assignment & Account Linking**  
**OWASP Category:** A01:2021 – Broken Access Control / A04:2021 – Insecure Design  
**CWE:** CWE-269: Improper Privilege Management, CWE-287: Improper Authentication

---

## Fix Applied
1. **Least-Privilege Role Assignment:** Modified the user creation logic in `backend/config/passport.js` so that new Google OAuth registrations are strictly assigned `role: 'user'`. The insecure hardcoded assignment of `role: 'admin'` was completely removed.
2. **Protection Against Pre-Account Takeover:** Implemented validation preventing blind account linking. If a local account exists matching the Google profile email, the account must already have `isEmailVerified: true` before linking Google identity credentials (`googleId`). If the local account is unverified, OAuth linking is rejected with an explicit error.
3. **Primary Lookups by Google ID:** Profile resolution queries first by immutable `googleId`. If a match is found, authentication completes without touching local credential state.
4. **Automated Test Coverage:** Added automated test suite `backend/__tests__/passportOAuth.test.js` exercising `handleGoogleAuth` across new user registration, unverified account linking rejection, and verified account linking preservation.

---

## Source Changes
- `backend/config/passport.js`: Extracted and updated `handleGoogleAuth` verify callback to enforce `role: 'user'` and require email verification prior to linking existing local accounts.
- `backend/__tests__/passportOAuth.test.js`: Added unit tests verifying `role: 'user'` assignment and account linking controls.

---

## Verification & Retest Results

### Runtime Verification Limitation Notice
> **IMPORTANT:** Runtime OAuth verification remains blocked because Google OAuth credentials are not configured in the clean test environment. Live OAuth authentication with accounts.google.com was not executed. Verification was conducted through static source analysis and automated unit test execution.

### 1. Static Source Code Verification
Inspection of `backend/config/passport.js` confirms:
```javascript
// 3. Create new user with least privilege (MUST be 'user', NEVER 'admin')
user = new User({
  name: profile.displayName || email.split('@')[0],
  email: email,
  googleId: profile.id,
  isEmailVerified: true, // Google accounts provide verified email
  role: 'user', // Least privilege: MUST NEVER default to admin
});
```
*Result:* `role: 'admin'` is completely absent from OAuth user provisioning.

### 2. Automated Test Execution
Executed `jest __tests__/passportOAuth.test.js`:
```
PASS __tests__/passportOAuth.test.js
  V05: Google OAuth Security & Role Assignment Tests
    ✓ MUST assign role "user" and NEVER "admin" to new Google OAuth users (4 ms)
    ✓ MUST reject blind linking to an existing unverified local account to prevent pre-account takeover (2 ms)
    ✓ allows linking to an existing verified account without granting admin escalation (1 ms)

Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

---

## Previous Vulnerable Behavior
Every newly created Google OAuth user was automatically assigned `role: 'admin'`, granting immediate administrator dashboard access to any visitor with a Google account. Unverified local accounts could be blindly hijacked via OAuth login.

## Current Behavior
Every newly created Google OAuth user receives `role: 'user'`. Accounts are verified before linking, preventing pre-account takeover and eliminating privilege escalation.

## Expected Secure Behavior
Third-party OAuth identity providers must never automatically provision administrative privileges. Local account linking must verify identity and account verification state.

## Result
**PASS** (Verified via static analysis and automated unit testing; runtime OAuth remains blocked by environment)

---

## Regression Test
- Ran full backend test suite (`npm test`): 13 test suites, 74 tests passing.
- Verified passport serialization and session mechanisms function correctly.

---

## Commit
- **Commit Hash:** `d0c7764` (earlier local iteration: `f2f704c`)
- **Commit Message:** `fix(security): prevent admin assignment during OAuth registration`
