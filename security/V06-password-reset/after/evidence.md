# AFTER-FIX EVIDENCE: V06 — Weak Password Reset Mechanism

## Vulnerability
**V06 — Weak Password Reset Mechanism (Predictable PRNG, Plaintext Token Storage, Lack of Attempt Throttling)**  
**OWASP Category:** A07:2021 – Identification and Authentication Failures  
**CWE:** CWE-330: Use of Insufficiently Random Values, CWE-307: Improper Restriction of Excessive Authentication Attempts, CWE-312: Cleartext Storage of Sensitive Information

---

## Fix Applied
1. **Cryptographically Secure Random Generation:** Replaced insecure `Math.random()` with `crypto.randomInt(100000, 1000000)` to generate uniform, unpredictable 6-digit reset codes.
2. **Cryptographic Hashing Before Database Storage:** Reset tokens are hashed using SHA-256 (`crypto.createHash('sha256')`) prior to storage in MongoDB. Cleartext codes are never stored or logged.
3. **Constant-Time Comparison:** User-supplied codes are hashed and compared against stored token hashes using `crypto.timingSafeEqual` with length validation to mitigate timing attacks.
4. **Strict Attempt Limiting & Invalidation:** Added `passwordResetAttempts` and `passwordResetLockUntil` fields to the User schema. Allowed failed attempts are capped at 5. Upon reaching the threshold, the active reset token is immediately wiped (`null`), and the account is locked out from password resets for 15 minutes (returning HTTP 429).
5. **Single-Use Token Lifecycle:** Upon successful password reset, `passwordResetToken`, `passwordResetExpires`, and attempt counters are atomically cleared. Replay or reuse of the token is strictly prevented.
6. **Expiration Enforcement:** Validates `passwordResetExpires` and discards expired tokens with HTTP 400.

---

## Source Changes
- `backend/src/models/User.js`: Added `passwordResetAttempts` (Number) and `passwordResetLockUntil` (Date) schema fields.
- `backend/src/controllers/userController.js`:
  - `forgotPassword`: Generates secure code via `crypto.randomInt`, hashes code via SHA-256 before saving, resets attempt counter and lock state.
  - `resetPassword`: Enforces lockout check (`passwordResetLockUntil`), expiration check, maximum attempt threshold (5), constant-time hash verification via `crypto.timingSafeEqual`, single-use invalidation upon completion.

---

## Retest Request

### 1. Password Reset Request & Database Inspection
```http
POST /api/users/forgot-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email": "v06_retest_user@solarcharge.local"}
```
**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"success": true, "message": "Password reset code sent to your email. Please check your inbox."}
```
**Database Document Verification:**
```json
{
  "email": "v06_retest_user@solarcharge.local",
  "passwordResetToken": "b8e8aa03c90ab31a3feff8fe4efb76ad3780d2f4cc5a8e3464aeac25ec712f69",
  "passwordResetAttempts": 0,
  "passwordResetLockUntil": null
}
```
*Result:* Cleartext 6-digit code is **NOT** present in database. Stored secret is a 64-character SHA-256 hexadecimal hash.

### 2. Repeated Invalid Guess Submissions & Lockout Enforcement
Submitted 6 sequential incorrect codes:
- **Attempts 1–4:** Returned `HTTP 400 Bad Request` with `{"success": false, "message": "Invalid or expired reset code"}`.
- **Attempt 5 (Max Threshold Reached):** Returned `HTTP 429 Too Many Requests`:
  ```http
  HTTP/1.1 429 Too Many Requests
  Content-Type: application/json; charset=utf-8

  {"success": false, "message": "Too many failed attempts. Reset code has been invalidated. Please request a new one."}
  ```
  *Database Check:* `passwordResetToken` was immediately set to `null` and `passwordResetLockUntil` was set to `+15 minutes`.
- **Attempt 6 (Account Lockout Active):** Returned `HTTP 429 Too Many Requests`:
  ```http
  HTTP/1.1 429 Too Many Requests
  Content-Type: application/json; charset=utf-8

  {"success": false, "message": "Too many failed attempts. Please request a new password reset."}
  ```

### 3. Expired Token Handling
Submitted valid format code against expired token timestamp (`Date.now() - 5000`):
```http
POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email": "v06_retest_user@solarcharge.local", "resetCode": "<EXPIRED_CODE>", "newPassword": "<NEW_PASSWORD>"}
```
**Response:** `HTTP 400 Bad Request` (`"Invalid or expired reset code"`).

### 4. Valid Password Reset
Submitted the authentic reset code corresponding to the SHA-256 hash:
```http
POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email": "v06_retest_user@solarcharge.local", "resetCode": "<VALID_CODE>", "newPassword": "<NEW_PASSWORD>"}
```
**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"success": true, "message": "Password reset successfully. You can now login with your new password."}
```

### 5. Token Reuse Prevention
Immediately resubmitted the identical code:
```http
POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email": "v06_retest_user@solarcharge.local", "resetCode": "<VALID_CODE>", "newPassword": "<NEW_PASSWORD>"}
```
**Response:** `HTTP 400 Bad Request` (`"Invalid or expired reset code"`). Replay attack rejected.

### 6. Authentication with New Password
Authenticated via `POST /api/users/login` with the newly updated password:
**Response:** `HTTP 200 OK` with valid user session.

---

## Previous Vulnerable Behavior
Reset code was generated with `Math.random()`, stored in plaintext in MongoDB, lacked attempt tracking or lockout mechanisms, and permitted unlimited brute-force guessing without code invalidation.

## Current Behavior
Reset codes use cryptographically secure random values, are stored as SHA-256 hashes, are compared in constant time, are subject to a strict 5-attempt limit with automatic invalidation and 15-minute lockout, and are invalidated immediately upon first successful use.

## Expected Secure Behavior
Reset codes must be unguessable, hashed in the database, rate-limited against brute force, and destroyed upon use or excessive failures.

## Result
**PASS**

---

## Regression Test
- Ran full backend test suite (`npm test`): 12 test suites, 71 tests passing.
- Verified standard forgot-password and reset-password flows maintain full functionality.

---

## Commit
- **Commit Hash:** `edf744a`
- **Commit Message:** `fix(security): harden password reset token handling`
