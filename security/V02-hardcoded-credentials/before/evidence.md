# BEFORE-FIX EVIDENCE: V02 — Hardcoded Credentials

**Vulnerability:** Hardcoded Third-Party Email & Application Password (SMTP Credentials)  
**OWASP Category:** A02:2021 – Cryptographic Failures  
**Affected Component:** `backend/src/utils/emailService.js`  
**Preconditions:** None (static code and repository analysis)  

---

## Vulnerability Description & Flow

1. In `backend/src/utils/emailService.js`, the developer hardcoded cleartext credentials for a Gmail account and a 16-character Google App Password into the email service utility.
2. In function `sendVerificationEmail`:
   ```javascript
   // Lines 36-39
   // Use hardcoded credentials for now (in production, use .env)
   const emailUser = 'nad***23@gmail.com';  // [REDACTED]
   const emailPass = 'nictbifwbr******';    // [REDACTED]
   ```
3. In function `sendPasswordResetEmail`:
   ```javascript
   // Lines 164-167
   // Use hardcoded credentials for now (in production, use .env)
   const emailUser = 'nad***23@gmail.com';  // [REDACTED]
   const emailPass = 'nictbifwbr******';    // [REDACTED]
   ```
4. These credentials instantiate Nodemailer's SMTP transport to send live emails to arbitrary recipient addresses upon registration and password reset triggers.
5. In addition, fallback JWT secrets are hardcoded in `backend/src/controllers/userController.js:25` and `backend/app.js:53`:
   ```javascript
   const secret = process.env.JWT_SECRET || 'fallback_secret';
   ```

---

## Git History Evidence

The credentials were added in commit `2e85bd257d586df1c745763a92c055defe8f557b`:

* **Commit SHA:** `2e85bd257d586df1c745763a92c055defe8f557b`
* **Author:** `LinukaM0 <Linukamanmith@gmail.com>`
* **Date:** `Mon Feb 16 10:28:16 2026 +0530`
* **Commit Message Subject:** `user_management`
* **File Diff:** `backend/utils/emailService.js` (subsequently moved to `backend/src/utils/emailService.js`)

In addition, commit `2e85bd2` also added `backend/.env.example` containing a live MongoDB Atlas connection string with embedded database credentials (`it23213944_db_user:[REDACTED]@cluster0...`).

---

## Observed Result vs Expected Secure Result

* **Observed Result:** Production SMTP credentials and fallback JWT secrets are permanently committed to repository source code and Git history.
* **Expected Secure Result:** Sensitive credentials and secrets must strictly reside in environment variables (`process.env.EMAIL_USER`, `process.env.EMAIL_PASS`, `process.env.JWT_SECRET`). Missing environment variables in production should abort startup with a fatal configuration error rather than fall back to insecure static values.
* **Safety Constraint Followed:** Per safety directives, no unauthorized live authentication against Gmail was attempted.

**Impact:** Account takeover of the sending email address, unauthorized SMTP relaying, reputation loss, blacklisting, and potential cryptographic token forgery via known fallback secrets.  
**Source Location:** `backend/src/utils/emailService.js:37-38, 165-166`, `backend/src/controllers/userController.js:25`, `backend/app.js:53`.  
**Runtime Verification:** **SOURCE CONFIRMED / RUNTIME BLOCKED** (Third-party account access intentionally avoided per assignment safety rules)  
**Evidence Files:** `security/V02-hardcoded-credentials/before/evidence.md`
