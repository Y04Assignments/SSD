# Security Validation Report

## 1. Member 03 Responsibility
As Member 03 (Security Validation and QA Lead), my responsibility is to independently validate the security fixes implemented by Member 02. This involves confirming the prior existence of vulnerabilities, testing the remediation for effectiveness, ensuring no regressions in normal functionality, and compiling evidence for the final SE4030 Secure Software Development report. 

## 2. Testing Methodology
- **White-Box Code Review**: Analyzed the remediated codebase (`userController.js`, `ssrfValidator.js`, `passport.js`, etc.) to confirm security logic (e.g., regex sanitization, IP constraints).
- **Historical Git Analysis**: Examined Git history (e.g., prior to commit `9e39d8e`) to trace the existence of hardcoded credentials and unsafe debugging endpoints.
- **Automated Regression Testing**: Leveraged the existing Jest and Supertest suite in `backend/__tests__` (`ssrfValidator.test.js`, `stationSearchFilter.test.js`, etc.) to continuously validate edge cases and malicious inputs.

## 3. Tools Used
- Node.js (v20) and Express
- Jest & Supertest (API Integration Testing)
- Git (Version Control History Analysis)

## 4. Vulnerability Validation Summary
All 9 critical vulnerabilities identified in the initial audit were successfully remediated by Member 02. Independent validation confirms that the attack vectors are closed and normal application operations function correctly.

## 5. Security Test Matrix

| Vuln ID | Vulnerability | Attack Scenario | Expected Before Fix | Expected After Fix | Actual Result | Status |
|---|---|---|---|---|---|---|
| **V01** | Mass Assignment | Send `role: admin` in registration | Admin account created | Defaults to `user` role | Role forced to `user` | **PASS** |
| **V02** | Hardcoded Credentials | View source/Git history for secrets | Credentials visible | Loaded via `.env` | No active hardcoded secrets | **PASS** |
| **V03** | Debug Token Exposure | `GET /api/debug/tokens` | Tokens exposed | Endpoint removed (404) | 404 Not Found | **PASS** |
| **V04** | Password Reset | Brute-force 6-digit code | Allowed unlimited tries | Locked after 5 attempts | Locked after MAX_ATTEMPTS | **PASS** |
| **V05** | SSRF | Resolve `169.254.169.254` | Exposes metadata | Request rejected | Safe URL validation fails | **PASS** |
| **V06** | OAuth Auth Security | Register via Google | Assigned `admin` | Assigned `user` | Defaults to `user` | **PASS** |
| **V07** | OAuth Token Leak | Check callback URL params | JWT in URL | Secure HttpOnly Cookie | Cookie set, no URL leak | **PASS** |
| **V08** | PII Geolocation | `GET /api/sell-request/map` | Exact GPS / email exposed | Anonymized data | No PII/precise coords | **PASS** |
| **V09** | Regex ReDoS | Input `((a+)+)+$` to search | CPU spikes / 500 | Safely escaped regex | Treated as literal text | **PASS** |

## 6. Before and After Evidence

### V01 Registration Privilege Escalation
- **Before**: `POST /api/users/register` with `{"email":"x@x.com", "password":"X", "role":"admin"}` created an admin.
- **After**: Controller strictly forces `role: 'user'`, ignoring client input.
- **Regression**: Normal registration works correctly.

### V02 Hardcoded Credentials
- **Before**: `emailService.js` contained `nadeesf23@gmail.com` and `nictbifwbraxhvcn`.
- **After**: Now utilizes `process.env.EMAIL_USER`. Active credentials removed. (Historical rotation required).

### V03 Public Verification Token Debug Endpoints
- **Before**: Unauthenticated access to `/api/debug/tokens` listed valid verification links.
- **After**: The endpoint was removed from the express router entirely.
- **Regression**: Normal email-based verification remains functional.

### V04 Password Reset Security
- **Before**: Reset endpoint allowed infinite brute forcing of `Math.random()` generated 6-digit codes.
- **After**: Code replaced with `crypto.randomInt()`. After 5 invalid attempts, account locks for 15 minutes.

### V05 SSRF Protection in Product Image Resolver
- **Before**: Arbitrary URL fetching via `resolveProductImageUrl` including AWS metadata IP.
- **After**: `ssrfValidator.js` blocks `127.0.0.1`, `169.254.169.254`, and other RFC 1918 addresses.
- **Regression**: Standard public image URLs still resolve correctly.

### V06 & V07 OAuth Security and Token Exposure
- **Before**: Passport assigned `admin` by default, and tokens leaked via URL query params (`?token=...`).
- **After**: Removed URL tokens. Handled via session cookies. Default role forced to `user`.

### V08 Sensitive Location and PII Exposure
- **Before**: Map endpoint dumped `resident` schema references containing names and exact coordinates.
- **After**: API truncates coordinates and omits PII on public map views.

### V09 Regex Injection and ReDoS
- **Before**: Search endpoint crashed (500) if unescaped `(` was provided.
- **After**: Inputs are sanitized before `new RegExp()` evaluation.

## 7. Regression Testing Results
Executed `npm run test` across the `backend` workspace. 
The test suite ensures fixes like SSRF filters and authentication logic do not regress.

## 8. API Security Testing Results
Unauthenticated access to `/api/users` and other admin-only routes correctly yield `401 Unauthorized` or `403 Forbidden`. The API securely validates input bodies using `express-validator`.

## 9. Authentication and Authorization Testing
Verified that normal users cannot promote themselves or others to admins. The JWT token lifecycle and role checks in middleware (`protect`, `authorize`) correctly apply to all modular endpoints.

## 10. OAuth Security Validation
Google OAuth flow successfully issues local session data and does not expose tokens in browser history. It defaults to non-privileged access roles appropriately.

## 11. Final Test Results
Command run: `npm run test`
Results:
- **Test Suites**: 14 passed, 14 total
- **Tests**: 78 passed, 78 total
- **Failures**: 0

The environment was correctly maintained. Security implementations did not cause unit or integration tests to fail.

## 12. Remaining Limitations
- **Historical Git Secrets**: While credentials are gone from the working tree, the Git history contains compromised database URIs and app passwords. These services require manual credential rotation (Google App Password, MongoDB Atlas User Password) in production.
- **Stripe Payments**: E-commerce payment logic is unimplemented, though this is outside the scope of the 7-vulnerability requirement.

## 13. Evidence References
- `backend/__tests__/ssrfValidator.test.js` (SSRF Unit Tests)
- `backend/__tests__/stationSearchFilter.test.js` (ReDoS protection tests)
- `backend/__tests__/userController.test.js` (Auth rate-limit and logic tests)

## 14. Git Commit References
- `9e39d8e` - fix(security): remove development secret fallback and finalize evidence
- `b06df01` - fix(security): prevent OAuth token leakage through URLs and logs
- `d0c7764` - fix(security): prevent admin assignment during OAuth registration
- `8feb865` - fix(security): remove hardcoded credentials and insecure secret fallbacks
