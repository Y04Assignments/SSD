# BEFORE-FIX EVIDENCE: V06 — Weak Password Reset Mechanism

**Vulnerability:** Weak PRNG, Low-Entropy 6-Digit PIN, Plaintext Storage, and Lack of Rate Limiting in Password Reset  
**OWASP Category:** A07:2021 – Identification and Authentication Failures  
**Affected Component:** `POST /api/users/forgot-password` and `POST /api/users/reset-password`  
**Preconditions:** A registered user account  

---

## Attack Description & Flow

1. A user requests a password reset via `POST /api/users/forgot-password`.
2. The controller (`backend/src/controllers/userController.js:356-361`) generates a 6-digit numeric PIN using `Math.random()`:
   ```javascript
   // Generate 6-digit reset code
   const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
   user.passwordResetToken = resetCode;
   user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
   await user.save();
   ```
3. Weaknesses identified in code and architecture:
   * **Predictable PRNG:** `Math.random()` is not cryptographically secure and can be predicted.
   * **Low Entropy:** A 6-digit code has only 900,000 possibilities (100000–999999).
   * **Plaintext Storage:** The code is stored unhashed in the database (`passwordResetToken`).
   * **Absence of Rate Limiting / Lockout:** The reset endpoint has no attempt tracking, lockout, or IP rate limiting.
   * **Code Not Invalidated on Failure:** Submitting incorrect guesses does not invalidate the active code or decrement an attempt counter.

---

## Runtime Verification Logs

### 1. Triggering Password Reset

```http
POST /api/users/forgot-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email": "test_admin@test.com"}

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"success":true,"message":"Password reset code sent to your email. Please check your inbox."}
```

### 2. Database Inspection (Plaintext Token Verification)

Inspection of the user's MongoDB document confirms the code is stored in cleartext:

```json
{
  "email": "test_admin@test.com",
  "passwordResetToken": "643104",
  "passwordResetExpires": "2026-09-25T21:41:23.289Z"
}
```

### 3. Deliberate Incorrect Guess Submissions (No Lockout / No Throttling)

Five incorrect codes (`000000`, `111111`, `222222`, `333333`, `444444`) were submitted sequentially:

```http
POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email":"test_admin@test.com","resetCode":"000000","newPassword":"NewPassword123!"}
HTTP Status: 400 Bad Request
{"success":false,"message":"Invalid or expired reset code"}

POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email":"test_admin@test.com","resetCode":"111111","newPassword":"NewPassword123!"}
HTTP Status: 400 Bad Request
{"success":false,"message":"Invalid or expired reset code"}
...
```

* **Rate Limiting Observed:** None (0.001s latency per request, no 429 status returned).
* **Account Lockout Observed:** None.
* **Attempt Counter in DB:** `NO_ATTEMPT_COUNTER_EXISTS`.
* **Token State:** Token `'643104'` remained valid and active in database after failed attempts.

### 4. Successful Password Reset with Original Token

Submitting the active code `'643104'` after multiple failed guesses succeeded immediately:

```http
POST /api/users/reset-password HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{"email":"test_admin@test.com","resetCode":"643104","newPassword":"BrandNewPassword123!"}

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"success":true,"message":"Password reset successfully. You can now login with your new password."}
```

Subsequent login with `BrandNewPassword123!` was authenticated with HTTP 200 OK.

---

## Observed Result vs Expected Secure Result

* **Observed Result:** 6-digit PIN stored in cleartext; failed guesses did not throttle the client, trigger backoff, or invalidate the token; valid code remained redeemable.
* **Expected Secure Result:** Reset tokens must be generated using `crypto.randomBytes()`, cryptographically hashed (SHA-256) before database storage, subject to strict rate-limiting (e.g. 3 attempts max), and automatically invalidated upon 3 consecutive failed verification attempts.

**Impact:** Account takeover via brute-force enumeration of 6-digit reset codes within the 10-minute validity window.  
**Source Location:** `backend/src/controllers/userController.js:356-361, 417-435`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V06-password-reset/before/evidence.md`
