# Security Validation Report (Audited)

## 1. Member 03 Responsibility
As Member 03 (Security Validation and QA Lead), my responsibility is to independently validate the security fixes implemented by Member 02. This involves checking whether vulnerabilities were remediated and ensuring no regressions occurred in normal functionality. 

**Important Methodology Note**: As the QA Lead joining after the remediation phase, I did *not* dynamically execute or live-reproduce the vulnerable code to generate "Before" evidence. "Before" evidence is based entirely on historical Git analysis and code inspection of prior commits. My validation relies on a combination of automated regression testing for the "After" state and manual source code inspection.

## 2. Testing Methodology
The validation was conducted using the following categories of evidence:
- **A. Automated Regression Testing**: Running the existing Jest/Supertest suite to verify the fix works and legitimate functionality is preserved.
- **B. Security Specific Validation**: Dedicated tests inside the suite testing malicious input (e.g., SSRF blocks, ReDoS blocks).
- **C. Historical Git Evidence**: Reviewing the Git history (specifically prior to commit `9e39d8e`) to confirm that vulnerable patterns existed.
- **D. Manual Code Inspection**: Reading the current router, controller, and model logic to confirm that flawed logic has been removed.
- **E. Tests Not Performed**: Live exploitation of the vulnerable states was not performed.

## 3. Tools Used
- Node.js (v20) and Express
- Jest & Supertest (API Integration Testing)
- Git (Version Control History Analysis)

## 4. Vulnerability Validation Summary
The claim that "all 9 vulnerabilities were independently validated" requires qualification. I successfully confirmed that the *current codebase is secure* against the 9 vulnerabilities using automated tests and manual inspection. I also verified the historical existence of the vulnerabilities via Git history. However, I did not manually exploit the original vulnerabilities on a running instance.

## 5. Security Test Matrix

| Vuln ID | Vulnerability | Attack Scenario | Actual Test Performed | Expected Secure Behaviour | Actual Observed Result | Status | Evidence Type |
|---|---|---|---|---|---|---|---|
| **V01** | Mass Assignment | Send `role: admin` in registration | Inspected controller logic | Defaults to `user` role | Role forced to `user` | **PASS** | Manual Code Inspection |
| **V02** | Hardcoded Credentials | View source/Git history for secrets | Checked source & `.env.example` | Loaded via `.env` | No active hardcoded secrets | **PASS** | Historical Git Evidence & Code Inspection |
| **V03** | Debug Token Exposure | `GET /api/debug/tokens` | Checked router for debug routes | Endpoint removed (404) | 404 Not Found | **PASS** | Historical Git Evidence & Code Inspection |
| **V04** | Password Reset | Brute-force 6-digit code | Inspected controller brute-force logic | Locked after 5 attempts | Code locked after MAX_ATTEMPTS | **PASS** | Historical Git Evidence & Code Inspection |
| **V05** | SSRF | Resolve `169.254.169.254` | Ran `ssrfValidator.test.js` | Request rejected | Safe URL validation fails | **PASS** | Security Specific Validation |
| **V06** | OAuth Auth Security | Register via Google | Ran `passportOAuth.test.js` | Assigned `user` | Defaults to `user` | **PASS** | Security Specific Validation |
| **V07** | OAuth Token Leak | Check callback URL params | Ran `authExchange.test.js` | Secure HttpOnly Cookie / No URL | Code exchange rejects reuse | **PASS** | Security Specific Validation |
| **V08** | PII Geolocation | `GET /api/sell-request/map` | Inspected controller response logic | Anonymized data | No PII/precise coords | **PASS** | Historical Git Evidence & Code Inspection |
| **V09** | Regex ReDoS | Input `((a+)+)+$` to search | Ran `stationSearchFilter.test.js` | Safely escaped regex | Treated as literal text | **PASS** | Security Specific Validation |

## 6. Before and After Evidence

### V01 Registration Privilege Escalation
- **Vulnerability Description**: Registration allowed the client to dictate their role.
- **Before**: *Historical evidence from Git history* shows `User.create(req.body)` without role filtering.
- **After**: Code inspection reveals `role: 'user'` is strictly overridden in the payload.
- **Regression**: Normal registration works correctly.

### V02 Hardcoded Credentials
- **Vulnerability Description**: Secrets were hardcoded in `emailService.js`.
- **Before**: *Historical evidence from Git history* proves `emailService.js` contained real Gmail credentials.
- **After**: File inspection proves it utilizes `process.env.EMAIL_USER`.
- **Limitation**: The original secrets still exist in Git history and require external credential rotation.

### V03 Public Verification Token Debug Endpoints
- **Vulnerability Description**: Unauthenticated access to `/api/debug/tokens` listed valid verification links.
- **Before**: *Historical evidence from Git history* shows the debug router existed.
- **After**: The endpoint was removed from the express router entirely.
- **Regression**: Normal email verification functionality remains functional.

### V04 Password Reset Security
- **Vulnerability Description**: Insufficient entropy and lack of rate-limiting allowed password reset brute-forcing.
- **Before**: *Historical evidence from Git history* shows `Math.random()` and no attempt tracking.
- **After**: Controller limits attempts to 5 and uses `crypto.randomInt()`.
- **Limitation**: Evaluated via code inspection; live brute-force automated tests were not performed.

### V05 SSRF Protection in Product Image Resolver
- **Vulnerability Description**: Arbitrary URL fetching via image resolver.
- **Before**: *Historical evidence from Git history* shows unvalidated URL fetching.
- **After**: Automated testing (`ssrfValidator.test.js`) verifies that `127.0.0.1`, `169.254.169.254`, and other RFC 1918 addresses are blocked.
- **Regression**: Legitimate public URLs still resolve correctly.

### V06 & V07 OAuth Security and Token Exposure
- **Vulnerability Description**: Passport assigned `admin` by default, and tokens leaked via URL query params (`?token=...`).
- **Before**: *Historical evidence from Git history* shows `role: 'admin'` in Passport callback and tokens in redirect strings.
- **After**: Automated testing (`passportOAuth.test.js` and `authExchange.test.js`) verify new users are assigned the `user` role and token exchanges operate securely.

### V08 Sensitive Location and PII Exposure
- **Vulnerability Description**: Map endpoint dumped `resident` schema references containing names and exact coordinates.
- **Before**: *Historical evidence from Git history* shows population of the entire resident document.
- **After**: Manual code inspection reveals the controller safely strips the user object and truncates GPS coordinates.
- **Limitation**: No automated test was found for this specific truncation.

### V09 Regex Injection and ReDoS
- **Vulnerability Description**: Search endpoint crashed (500) if unescaped `(` was provided.
- **Before**: *Historical evidence from Git history* shows `new RegExp(req.query.search, 'i')`.
- **After**: Automated testing (`stationSearchFilter.test.js`) confirms inputs are sanitized.

## 7. Regression Testing Results
Executed `npm run test` across the `backend` workspace. 
The test suite ensures fixes like SSRF filters and authentication logic do not regress.

## 8. Final Test Results
Command run: `npm run test`
Results:
- **Test Suites**: 14 passed, 14 total
- **Tests**: 78 passed, 78 total
- **Failures**: 0

The environment was correctly maintained. Security implementations did not cause unit or integration tests to fail.

## 9. Remaining Limitations
- **Historical Git Secrets**: While credentials are gone from the working tree, the Git history contains compromised database URIs and app passwords. These services require manual credential rotation (Google App Password, MongoDB Atlas User Password) in production.
- **Lack of Comprehensive End-to-End Live Validation**: Many vulnerabilities were verified via unit tests or manual code inspection. Full live exploit reproduction was explicitly not performed.

## 10. Evidence References
- `backend/__tests__/ssrfValidator.test.js` (SSRF Unit Tests)
- `backend/__tests__/stationSearchFilter.test.js` (ReDoS protection tests)
- `backend/__tests__/authExchange.test.js` (OAuth security tests)
- `backend/__tests__/passportOAuth.test.js` (OAuth role tests)

## 11. Git Commit References
- `9e39d8e` - fix(security): remove development secret fallback and finalize evidence
- `b06df01` - fix(security): prevent OAuth token leakage through URLs and logs
- `d0c7764` - fix(security): prevent admin assignment during OAuth registration
- `8feb865` - fix(security): remove hardcoded credentials and insecure secret fallbacks
