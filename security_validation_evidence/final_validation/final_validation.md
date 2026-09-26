# Final Security Validation Report
## SE4030 Secure Software Development — SolarCharge-Finder

**Validator:** Security Validation & QA Lead (Member 03)  
**Branch:** `member---03--security-validation-&-QA-Lead`  
**Date:** 2026-09-26  
**Backend tested:** http://localhost:5001 (live, running)  
**Test framework:** Jest 29 (Node.js ESM)  
**Overall Result:** ALL 9 VULNERABILITIES VERIFIED AS FIXED

---

## Executive Summary

This report documents independent security validation of 9 vulnerabilities identified and
fixed by the SolarCharge-Finder development team. All fixes confirmed via:
- Static source code analysis
- Live API testing (curl to running backend)
- Automated regression unit tests (81 tests, 0 failures)
- Git commit history verification
- Project audit documentation review (About.md)

---

## Validation Results

### VULN-01: Mass Assignment to Admin Role
- Fix Commit: 32ef852
- BEFORE: validation.js allowed role:'admin' from request body; controller used `role || 'user'`
- AFTER: Role field removed from validator; controller hardcodes `role: 'user'`
- Live Test: POST /api/users/register with role:"admin" -> HTTP 201, role:"user" returned
- Unit Test: V01 test in userAuth.test.js -> PASSED
- Result: PASS

### VULN-02: Hardcoded Credentials and Secrets
- Fix Commits: 8feb865, 9e39d8e
- BEFORE: Gmail credentials + MongoDB URI hardcoded in source; hardcoded session fallback
- AFTER: All from process.env.*; crypto.randomBytes() for dev fallback; production throws if missing
- Validation: Static code inspection confirms no hardcoded secrets in current code
- Limitation: SMTP not tested (no credentials available)
- Result: PASS

### VULN-03: Public Debug Endpoint Exposing Verification Tokens
- Fix Commit: 1576a8a
- BEFORE: GET /api/debug/tokens returned all verification tokens publicly
- AFTER: debug.js uses router.all('*') returning 404; route not mounted in app.js
- Live Test: GET /api/debug/tokens -> HTTP 404; GET /api/debug/tokens/:email -> HTTP 404
- Screenshots: VULN_03/after/01_debug_tokens_404_after.png, 02_debug_tokens_email_404_after.png
- Result: PASS

### VULN-04: Server-Side Request Forgery (SSRF)
- Fix Commit: 2015a97
- BEFORE: Only protocol check; no IP range validation; arbitrary internal URLs fetched
- AFTER: ssrfValidator.js blocks RFC1918, loopback, cloud metadata, localhost, IPv6 private
- Unit Tests: 13 tests in ssrfValidator.test.js -> ALL PASSED
- Limitation: Live cloud metadata (169.254.169.254) not probed directly
- Result: PASS

### VULN-05: Insecure Default Role in Google OAuth
- Fix Commit: d0c7764
- BEFORE: passport.js set role:'admin' for all OAuth users; User model defaulted to 'admin'
- AFTER: role:'user' hardcoded; model default changed; unverified accounts blocked from linking
- Unit Tests: 3 tests in passportOAuth.test.js -> ALL PASSED
- Limitation: Live Google OAuth flow not tested (no valid credentials)
- Result: PASS

### VULN-06: Insecure Password Reset Token
- Fix Commit: f70aea2
- BEFORE: Math.random() PRNG; plaintext storage; no rate limiting; timing-unsafe comparison
- AFTER: crypto.randomInt() CSPRNG; SHA-256 hash; 5-attempt lockout; timingSafeEqual; invalidated after use
- Live Test: Invalid code -> HTTP 400 confirmed
- Unit Test: V04 rate limit test -> 5th attempt returns HTTP 429 -> PASSED
- Result: PASS

### VULN-07: Unauthenticated PII and Geolocation Exposure
- Fix Commit: 843b1af
- BEFORE: GET /api/sell-request/map returned resident.name, resident.email, exact GPS publicly
- AFTER: No populate; coordinates fuzzed to 2 decimal places; "Solar Seller #XXXX" identifier
- Live Test: GET /api/sell-request/map -> {username:"Solar Seller #ea67", coordinates:[80.01,7.56]}
- Screenshot: VULN_07/after/01_sell_request_map_anonymized_after.png
- Unit Test: V08 test in sellRequestController.test.js -> PASSED
- Result: PASS

### VULN-08: RegExp Denial of Service (ReDoS)
- Fix Commit: d107917
- BEFORE: new RegExp(search, 'i') compiled raw user input; SyntaxError / catastrophic backtracking possible
- AFTER: escapeRegex() escapes all metacharacters before RegExp compilation
- Live Test: GET /api/stations/search?search=((a%2B)%2B)%2B%24 -> HTTP 200 (not 500)
- Screenshots: VULN_08/after/01_station_search_normal_after.png, 02_station_search_redos_safe_after.png
- Unit Tests: 9 station search tests in stationSearchFilter.test.js -> ALL PASSED
- Result: PASS

### VULN-14: OAuth Token Leakage via URL
- Fix Commit: b06df01
- BEFORE: Full JWT in URL query string (?token=eyJhbGci...); visible in logs, history, referrer headers
- AFTER: One-time 256-bit authorization code (?code=...) with 60s TTL; JWT via HttpOnly cookie
- Unit Tests: 4 tests in authExchange.test.js -> ALL PASSED (valid exchange, single-use, expiry, missing code)
- Limitation: Live OAuth redirect flow not tested (no valid Google credentials)
- Result: PASS

---

## Regression Test Summary

Command: npm test -- --forceExit --verbose
Directory: backend/

Test Suites: 14 passed, 14 total
Tests:       81 passed, 81 total  
Time:        2.298s
Exit Code:   0 (SUCCESS)

No regressions detected.

---

## Evidence Collected: 27 Items

- Live API tests: 8
- Browser screenshots: 7
- Text evidence files (code + analysis): 16
- Git commits verified: 10
- Automated unit tests: 81 (across 14 suites)

---

## Limitations

1. Google OAuth flow not tested end-to-end (no credentials) - unit tests substitute
2. SMTP not tested (no credentials; code skips gracefully)
3. SSRF cloud metadata not probed live - 13 unit tests substitute
4. BEFORE states not reproduced live (code is already fixed; modification prohibited)
   - Documented via Git diffs and project audit (About.md)

---

## Conclusion

All 9 documented vulnerabilities have been correctly remediated. Fixes are conservative,
targeted, and do not break existing application functionality. The test suite demonstrates
security properties hold under automated testing. All limitations are fully disclosed.

The SolarCharge-Finder backend meets the security requirements of the SE4030 assignment
as documented in About.md.

Signed: Security Validation & QA Lead (Member 03)
Date: 2026-09-26
Commit: 296139c — "test(security): add M03 validation regression tests"
