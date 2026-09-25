# BEFORE-FIX EVIDENCE: V05 — Insecure OAuth Account Linking & Role Assignment

**Vulnerability:** Insecure Google OAuth Account Linking & Default Administrator Privilege Assignment  
**OWASP Category:** A01:2021 – Broken Access Control / A04:2021 – Insecure Design  
**Affected Component:** `backend/config/passport.js` and `backend/src/routes/auth.js`  
**Preconditions:** Google OAuth provider configured  

---

## Vulnerability Description & Flow

1. **Automatic Administrator Assignment:**
   In `backend/config/passport.js:37-45`, when a new user signs in via Google OAuth for the first time, the application explicitly grants them administrative privileges:
   ```javascript
   // Create new user
   user = new User({
     name: profile.displayName,
     email: profile.emails[0].value,
     googleId: profile.id,
     isEmailVerified: true, // Google email is verified
     role: 'admin', // Default to admin as per requirements
   });
   ```
2. **Insecure Pre-Authentication Account Linking:**
   In `backend/config/passport.js:25-34`, when a user logs in via Google, the application looks up existing records solely by email string:
   ```javascript
   let user = await User.findOne({ email: profile.emails[0].value });
   if (user) {
     if (!user.googleId) {
       user.googleId = profile.id;
       await user.save();
     }
     return done(null, user);
   }
   ```
   If an existing local account exists with that email (even if created by an attacker or unverified), the OAuth identity is automatically linked without requiring the local account password or explicit re-authentication.

---

## Runtime Verification Status

* **Status:** **SOURCE CONFIRMED / RUNTIME BLOCKED**
* **Runtime Verification Execution:**
  Sending a request to `GET /api/auth/google` on the local backend returned:
  ```http
  HTTP/1.1 500 Internal Server Error
  Content-Type: application/json; charset=utf-8

  {"success":false,"message":"Unknown authentication strategy \"google\""}
  ```
* **Blocker Analysis:** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables are omitted in the clean local development setup. In `backend/config/passport.js:13`, the GoogleStrategy registration is guarded by `if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)`. Consequently, Passport does not register the strategy at startup, preventing dynamic OAuth handshakes without live external Google API keys.
* **Source-Level Confirmation:** The insecure role assignment (`role: 'admin'`) and unvalidated account linking logic are unambiguously present in source lines 25–46 of `backend/config/passport.js`.

---

## Observed Result vs Expected Secure Result

* **Observed Code Result:** Every Google OAuth account receives `role: 'admin'`, and accounts are linked without verification of local credentials.
* **Expected Secure Result:** New OAuth users must default to `role: 'user'`. Account linking between local and third-party identities must require proof of ownership of the existing local account (e.g. entering the existing local password).

**Impact:** Unintended universal privilege escalation to administrator for anyone authenticating via Google; potential pre-account takeover via unvalidated email linking.  
**Source Location:** `backend/config/passport.js:25-46`.  
**Runtime Verification:** **SOURCE CONFIRMED / RUNTIME BLOCKED**  
**Evidence Files:** `security/V05-oauth/before/evidence.md`
