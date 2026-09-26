# Security Validation Evidence Index

**Project:** SolarCharge-Finder (SE4030 Secure Software Development)  
**Validator:** Security Validation & QA Lead (Member 03)  
**Date:** 2026-09-26  
**Backend:** http://localhost:5001 (Node.js/Express, running)

---

## Evidence Summary Table

| # | Vulnerability | Type | Filename | HTTP Status | Git Commit | Limitation |
|---|---|---|---|---|---|---|
| 1 | VULN-01 | BEFORE (Historical Git diff) | `VULN_01/before/01_vulnerable_code_before.txt` | N/A | `32ef852` parent | Historical only |
| 2 | VULN-01 | AFTER (Live API text) | `VULN_01/after/01_mass_assignment_fixed_after.txt` | 201 | `32ef852` | None |
| 3 | VULN-01 | AFTER (Screenshot - 401 on admin route) | `VULN_01/after/02_admin_users_401_after.png` | 401 | — | None |
| 4 | VULN-01 | AFTER (Screenshot - API running) | `VULN_01/after/01_api_running.png` | 200 | — | None |
| 5 | VULN-02 | BEFORE (Historical audit doc) | `VULN_02/before/01_hardcoded_credentials_before.txt` | N/A | `2e85bd25` | Credentials REDACTED |
| 6 | VULN-02 | AFTER (Static code inspection) | `VULN_02/after/01_environment_variables_after.txt` | N/A | `8feb865`, `9e39d8e` | SMTP not tested - no creds |
| 7 | VULN-03 | BEFORE (Historical audit doc) | `VULN_03/before/01_debug_route_before.txt` | N/A | `1576a8a` parent | Historical only |
| 8 | VULN-03 | AFTER (Screenshot - 404) | `VULN_03/after/01_debug_tokens_404_after.png` | 404 | `1576a8a` | None |
| 9 | VULN-03 | AFTER (Screenshot - 404 targeted) | `VULN_03/after/02_debug_tokens_email_404_after.png` | 404 | `1576a8a` | None |
| 10 | VULN-03 | AFTER (Text - code analysis) | `VULN_03/after/01_debug_endpoint_disabled_after.txt` | 404 | `1576a8a` | None |
| 11 | VULN-04 | BEFORE (Historical audit doc) | `VULN_04/before/01_ssrf_vulnerable_code_before.txt` | N/A | `2015a97` parent | BEFORE not live-reproduced (prohibited) |
| 12 | VULN-04 | AFTER (Unit tests + static) | `VULN_04/after/01_ssrf_fixed_validator_after.txt` | 401/blocked | `2015a97` | Live SSRF payloads to cloud metadata not submitted |
| 13 | VULN-05 | BEFORE (Historical audit doc) | `VULN_05/before/01_oauth_role_admin_before.txt` | N/A | `d0c7764` parent | Historical only |
| 14 | VULN-05 | AFTER (Unit tests) | `VULN_05/after/01_oauth_role_user_fixed_after.txt` | N/A | `d0c7764` | Live Google OAuth not tested - no valid creds |
| 15 | VULN-06 | BEFORE (Historical audit doc) | `VULN_06/before/01_password_reset_vulnerable_before.txt` | N/A | `f70aea2` parent | Historical only |
| 16 | VULN-06 | AFTER (Live API + unit tests) | `VULN_06/after/01_password_reset_hardened_after.txt` | 400, 429 | `f70aea2` | Real reset emails not sent |
| 17 | VULN-07 | BEFORE (Historical audit doc) | `VULN_07/before/01_pii_exposure_vulnerable_before.txt` | N/A | `843b1af` parent | Historical only |
| 18 | VULN-07 | AFTER (Screenshot - anonymized) | `VULN_07/after/01_sell_request_map_anonymized_after.png` | 200 | `843b1af` | None |
| 19 | VULN-07 | AFTER (Text - code + live test) | `VULN_07/after/01_pii_anonymized_after.txt` | 200 | `843b1af` | None |
| 20 | VULN-08 | BEFORE (Historical audit doc) | `VULN_08/before/01_redos_vulnerable_code_before.txt` | 500 (historic) | `d107917` parent | Historical only |
| 21 | VULN-08 | AFTER (Screenshot - normal search) | `VULN_08/after/01_station_search_normal_after.png` | 200 | `d107917` | None |
| 22 | VULN-08 | AFTER (Screenshot - ReDoS safe) | `VULN_08/after/02_station_search_redos_safe_after.png` | 200 | `d107917` | None |
| 23 | VULN-08 | AFTER (Text - code + live test) | `VULN_08/after/01_redos_fixed_after.txt` | 200 | `d107917` | None |
| 24 | VULN-14 | BEFORE (Historical audit doc) | `VULN_14/before/01_oauth_token_url_before.txt` | N/A | `b06df01` parent | Historical only |
| 25 | VULN-14 | AFTER (Unit tests) | `VULN_14/after/01_oauth_code_exchange_after.txt` | 200, 400 | `b06df01` | Live Google OAuth flow not tested |
| 26 | Regression | Full test suite (81 tests) | `regression_testing/01_regression_test_results.txt` | N/A | — | None |
| 27 | Regression | Backend running screenshot | `regression_testing/00_backend_running.png` | 200 | — | None |

---

## VULN-01: Mass Assignment Evidence

### What the BEFORE state proves
Validator: `body('role').optional().isIn(['user', 'admin'])` allowed clients to set admin.  
Controller: `const { email, password, role } = req.body;` then `role: role || 'user'` used user-supplied value.

**Source:** Git diff of commit `32ef852` — the exact lines REMOVED by the security fix.

### What the AFTER state proves
**Live API test** confirmed:
```
POST /api/users/register {"email":"testattacker@test.com","password":"Password123!","role":"admin"}
→ HTTP 201: {"role": "user"}  ← role: "admin" was silently ignored
```

---

## VULN-02: Hardcoded Credentials Evidence

### What the BEFORE state proves
Project audit (About.md lines 170-173) documents:
- Gmail credentials (`nadeesf23@gmail.com` + App Password) hardcoded in `emailService.js`
- MongoDB Atlas URI with credentials committed in Git history

**Safety:** Real credentials are NOT shown in evidence files.

### What the AFTER state proves
All secrets now loaded from environment variables. Production throws fatal error if `SESSION_SECRET`/`JWT_SECRET` not set. Dev fallback uses `crypto.randomBytes(32)` (not a hardcoded string).

---

## VULN-03: Debug Endpoint Evidence

### What the BEFORE state proves
About.md documents: `GET /api/debug/tokens` returned all verification tokens publicly.

### What the AFTER state proves
**Live API tests:**
```
GET /api/debug/tokens        → HTTP 404 (Cannot GET /api/debug/tokens)
GET /api/debug/tokens/:email → HTTP 404
```
See screenshots in `VULN_03/after/`.

---

## VULN-04: SSRF Evidence

### What the BEFORE state proves
About.md lines 184-191: only protocol check (`isHttpUrl`), no IP range validation.

### What the AFTER state proves
13 unit tests in `ssrfValidator.test.js` pass, verifying:
- Loopback (127.x.x.x), RFC1918, cloud metadata (169.254.x.x) all blocked
- IPv6 loopback/mapped addresses blocked
- DNS resolution validated for every hop
- `safeFetch` re-validates on every redirect

---

## VULN-05: OAuth Role Evidence

### What the BEFORE state proves
About.md lines 193-199: `role: 'admin'` set in passport.js; User model default was `'admin'`.

### What the AFTER state proves
3 unit tests in `passportOAuth.test.js` pass:
1. New OAuth users get `role: 'user'` (never `'admin'`)
2. Unverified local accounts cannot be linked (pre-account takeover blocked)
3. Verified accounts can be linked without role escalation

---

## VULN-06: Password Reset Evidence

### What the BEFORE state proves
About.md lines 201-211: `Math.random()` PRNG, plaintext token storage, no rate limiting.

### What the AFTER state proves
- `crypto.randomInt()` (CSPRNG) for token generation
- SHA-256 hash storage (never plaintext)
- 5-attempt lockout with 15-minute penalty
- `crypto.timingSafeEqual()` for comparison
- **Live API:** Invalid code → HTTP 400; **Unit test:** 5th attempt → HTTP 429

---

## VULN-07: PII/Geolocation Evidence

### What the BEFORE state proves
About.md lines 213-219: `.populate('resident', 'name email')` exposed real identity and exact GPS.

### What the AFTER state proves
**Live API response from `GET /api/sell-request/map`:**
```json
{"username": "Solar Seller #ea67", "location": {"coordinates": [80.01, 7.56]}}
```
- No email, no real name, coordinates fuzzed to 2 decimal places (~1.1km area).

---

## VULN-08: ReDoS Evidence

### What the BEFORE state proves
About.md lines 221-232: `new RegExp(search, 'i')` with no input escaping.

### What the AFTER state proves
**Live API tests:**
```
GET /api/stations/search?search=test      → HTTP 200 (normal results)
GET /api/stations/search?search=((a+)+)+$ → HTTP 200 (safe, no crash)
```
`escapeRegex()` function escapes all special characters before RegExp compilation.

---

## VULN-14: OAuth Token Leakage Evidence

### What the BEFORE state proves
About.md lines 276-281: JWT token in `?token=...` URL parameter (browser history, logs, referrer headers).

### What the AFTER state proves
4 unit tests in `authExchange.test.js` pass:
- Code exchange delivers token securely
- Single-use: second redemption → HTTP 400
- Expired code → HTTP 400
- Missing code → HTTP 400

URL now contains only an opaque 256-bit authorization code (60s TTL), never the JWT.

---

## Testing Limitations

| Limitation | Reason | Substitute Evidence |
|---|---|---|
| Live Google OAuth not tested | No valid OAuth credentials in test env | `passportOAuth.test.js` + `authExchange.test.js` unit tests |
| SMTP not tested | No real credentials; safety rule against sending real emails | Source code confirms `process.env.EMAIL_USER/EMAIL_PASS` usage |
| SSRF cloud metadata not probed | Prohibited to query 169.254.169.254 even locally | 13 `ssrfValidator.test.js` unit tests |
| BEFORE states not live-reproduced | Code is already fixed; reverting would require modifying source | Git diffs + project audit documentation (About.md) |
| Credentials never exposed | Safety protocol | About.md confirms their existence; commits document removal |

---

## Git Commits Verified

| SHA | Message | Vulnerability |
|---|---|---|
| `32ef852` | fix(security): prevent role mass assignment during registration | VULN-01 |
| `8feb865` | fix(security): remove hardcoded credentials and insecure secret fallbacks | VULN-02 |
| `9e39d8e` | fix(security): remove development secret fallback and finalize evidence | VULN-02 |
| `1576a8a` | fix(security): remove public verification token debug endpoints | VULN-03 |
| `2015a97` | fix(security): prevent SSRF in product image resolver | VULN-04 |
| `d0c7764` | fix(security): prevent admin assignment during OAuth registration | VULN-05 |
| `f70aea2` | fix(security): harden password reset token handling | VULN-06 |
| `843b1af` | fix(security): minimize public sell request location data | VULN-07 |
| `d107917` | fix(security): escape user input in station search regex | VULN-08 |
| `b06df01` | fix(security): prevent OAuth token leakage through URLs and logs | VULN-14 |

## Regression Tests

**Command:** `npm test -- --forceExit --verbose`  
**Result:** `Test Suites: 14 passed, 14 total | Tests: 81 passed, 81 total | Time: 2.298s`  
**Exit Code:** 0 (SUCCESS)  
**No regressions introduced by security fixes.**
