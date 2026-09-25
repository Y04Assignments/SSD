# AFTER-FIX EVIDENCE: V02 — Hardcoded Third-Party Credentials & Insecure Fallbacks

## Vulnerability
**V02 — Hardcoded Third-Party SMTP Credentials and Insecure Secret Fallbacks**  
**OWASP Category:** A02:2021 – Cryptographic Failures / A05:2021 – Security Misconfiguration  
**CWE:** CWE-798: Use of Hard-coded Credentials, CWE-1188: Insecure Default Initialization of Resource

---

## Fix Applied
1. **Total Eradication of Hardcoded Email Credentials:** Removed the cleartext Gmail username and 16-character application password from `sendVerificationEmail` and `sendPasswordResetEmail` in `backend/src/utils/emailService.js`.
2. **Environment Variable Binding:** Outbound email transport is now strictly bound to `process.env.EMAIL_USER` and `process.env.EMAIL_PASS` using `createTransporter()`.
3. **Graceful Dev/Test Skipping:** When `EMAIL_USER` or `EMAIL_PASS` are omitted in non-production environments, email delivery logs a non-fatal message and skips outbound network transmission without crashing registration or password reset flows.
4. **Removal of Insecure Fallback Secrets:** Eradicated all occurrences of `'fallback_secret'` from `backend/src/controllers/userController.js` and `backend/app.js`.
5. **Fail-Safe Startup Validation:** Added explicit environment assertions in `backend/server.js` and `backend/app.js`. If `JWT_SECRET` or `SESSION_SECRET` are missing when `NODE_ENV === 'production'`, the server terminates immediately with a fatal exit code rather than running with insecure defaults.
6. **Safe Configuration Template:** Created `backend/.env.example` containing descriptive placeholder tokens without any live or real credentials.
7. **Credential Rotation Requirement:** Documented that the owner of the exposed Gmail account must immediately revoke the compromised Google App Password and rotate credentials.

---

## Source Changes
- `backend/src/utils/emailService.js`: Removed hardcoded credentials; bound transport exclusively to `process.env.EMAIL_USER` and `process.env.EMAIL_PASS`.
- `backend/src/controllers/userController.js`: Removed `|| 'fallback_secret'`; enforced mandatory `JWT_SECRET`.
- `backend/app.js`: Removed `|| 'fallback_secret'`; enforced production check for `SESSION_SECRET`/`JWT_SECRET`.
- `backend/server.js`: Added production startup fail-safe terminating if `JWT_SECRET` is unset.
- `backend/.env.example`: Added clean environment template with safe placeholder values.

---

## Retest Request

### 1. Static Source Code Scan
Searched entire active codebase for exposed email strings, passwords, and fallback tokens:
```bash
# Verify hardcoded Gmail account removed
git grep -i "nadeesf23" backend/
# Result: 0 matches (CLEAN)

# Verify hardcoded app password removed
git grep -i "nictbifw" backend/
# Result: 0 matches (CLEAN)

# Verify fallback_secret removed
git grep -i "fallback_secret" backend/
# Result: 0 matches (CLEAN)
```

### 2. Production Fail-Safe Startup Verification
Executed server startup under production mode with missing secrets:
```bash
NODE_ENV=production node backend/server.js
```
**Output / Exit Behavior:**
```
Error: FATAL: SESSION_SECRET or JWT_SECRET environment variable is required in production
    at file:///Users/.../backend/app.js:52:9
```
*Process exited with status code 1. Application refused to start with insecure missing secrets.*

### 3. Application Behavior with Environment Secrets
Started server with explicit test environment variables:
```bash
NODE_ENV=development JWT_SECRET="test_secure_jwt_secret_32_characters" PORT=5099 node backend/server.js
```
**Output:**
```
Server is running on port 5099
```
*Application initialized successfully using environment secrets.*

---

## Previous Vulnerable Behavior
Cleartext Gmail credentials and Google application passwords were hardcoded in active source files and executed automatically during registration and password resets. In addition, missing JWT secrets silently defaulted to the known string `'fallback_secret'`.

## Current Behavior
Active source code contains zero hardcoded credentials or fallback secrets. Email delivery strictly uses environment variables, and production startup refuses to run without configured secrets.

## Expected Secure Behavior
No cleartext credentials in source code; secrets must be provided via environment variables; production must fail safely if mandatory secrets are missing.

## Result
**PASS**

---

## Credential Revocation Notice
> **SECURITY ADVISORY:** The third-party Gmail account credentials previously exposed in Git history commit `2e85bd2` must be revoked immediately by the account owner in Google Account Security Settings (App Passwords).

---

## Regression Test
- Ran full backend test suite (`npm test`): 12 test suites, 71 tests passing.
- Verified email token generation and password reset flow continue to execute reliably.

---

## Commit
- **Commit Hash:** `f13eed8`
- **Commit Message:** `fix(security): remove hardcoded credentials and insecure secret fallbacks`
