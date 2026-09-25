# AFTER-FIX EVIDENCE: V01 — Registration Mass Assignment

**Vulnerability:** V01 — Mass Assignment leading to Admin Privilege Escalation  
**Fix Applied:** Removed the `role` field from the registration validator (`validateRegister`), enforced strict server-side assignment of `role: 'user'` during user creation in `userController.js`, and corrected the Mongoose `User` schema default role from `'admin'` to `'user'`.  
**Source Changes:**
* `backend/middleware/validation.js`: Removed `body('role').optional().isIn(['user', 'admin'])`.
* `backend/src/controllers/userController.js`: Discarded `role` from request body extraction; forced `role: 'user'` in `User.create()`.
* `backend/src/models/User.js`: Updated Mongoose schema definition from `default: 'admin'` to `default: 'user'`.

---

## Retest Request

A registration attempt was submitted with an injected `role: "admin"` parameter:

```http
POST /api/users/register HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{
  "email": "after_v01_test@solarcharge.local",
  "password": "TestPassword123!",
  "role": "admin"
}
```

---

## Comparison: Previous Vulnerable vs Current Behavior

* **Previous Vulnerable Behavior:**
  The server accepted `"role": "admin"`, returned `role: "admin"` in the response payload, persisted the user as an administrator in MongoDB, and granted immediate access to `/api/admin/stats`.
* **Current Behavior:**
  1. The server completely ignored the injected `"role": "admin"` parameter and returned:
     ```http
     HTTP/1.1 201 Created
     Content-Type: application/json; charset=utf-8

     {
       "success": true,
       "message": "User registered successfully. Please check your email to verify your account.",
       "data": {
         "user": {
           "id": "6ab6eb3c6dcb8e4984b5ca89",
           "email": "after_v01_test@solarcharge.local",
           "role": "user",
           "isEmailVerified": false
         }
       }
     }
     ```
  2. Direct query against MongoDB confirmed:
     ```json
     {
       "_id": "6ab6eb3c6dcb8e4984b5ca89",
       "email": "after_v01_test@solarcharge.local",
       "role": "user"
     }
     ```
  3. Attempting to access the admin endpoint `GET /api/admin/stats` with this account's JWT:
     ```http
     GET /api/admin/stats HTTP/1.1
     Host: 127.0.0.1:5001
     Authorization: Bearer <USER_JWT>

     HTTP/1.1 403 Forbidden
     Content-Type: application/json; charset=utf-8

     {"success":false,"message":"Access denied. User role user is not authorized."}
     ```

---

## Expected Secure Behavior

* Public registration must never grant administrative privileges based on client input.
* Public registrants must strictly receive the least-privilege `user` role.
* Non-admin users must be blocked from administrative routes with HTTP 403 Forbidden.

**Result:** **PASS**  
**Regression Test:** Executed `npm test` across all 11 backend test suites (58 passing tests). Normal user registration, login, and authorization validation remained fully functional.  
**Commit:** `fix(security): prevent role mass assignment during registration`
