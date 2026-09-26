# AFTER-FIX EVIDENCE: V11 — Missing Security Headers / No Rate Limiting

**Vulnerability:** V11 — Missing security headers and no rate limiting across the API
**Fix Applied:** Added `helmet` (with explicit `frame-ancestors` and `form-action` CSP directives) and `express-rate-limit` — a generous global limiter on all `/api` routes, plus a strict limiter specifically on `/register`, `/login`, `/forgot-password`, and `/reset-password`.

## Source Changes

* `backend/package.json` — added `helmet` and `express-rate-limit` dependencies.
* `backend/app.js`:
  ```javascript
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': ["'self'"],
        'form-action': ["'self'"],
      },
    },
  }));

  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
  app.use('/api', apiLimiter);
  ```
* `backend/src/routes/userRoutes.js`:
  ```javascript
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
  router.post('/register', authLimiter, registerUser);
  router.post('/login', authLimiter, loginUser);
  router.post('/forgot-password', authLimiter, forgotPassword);
  router.post('/reset-password', authLimiter, resetPassword);
  ```

### 1. Header Inspection Request

{
    "email": "nobody@test.com",
    "password": "wrong"
}

### 2. Rate Limit Retest (Collection Runner, 20 iterations)
Rate Limit Test — 20 requests to POST /api/users/login

Iteration 01: 401
Iteration 02: 401
Iteration 03: 401
Iteration 04: 401
Iteration 05: 401
Iteration 06: 401
Iteration 07: 401
Iteration 08: 401
Iteration 09: 401
Iteration 10: 401
Iteration 11: 429
Iteration 12: 429
Iteration 13: 429
Iteration 14: 429
Iteration 15: 429
Iteration 16: 429
Iteration 17: 429
Iteration 18: 429
Iteration 19: 429
Iteration 20: 429

## Comparison: Previous Vulnerable vs Current (Expected) Behavior

* **Previous Vulnerable Behavior:** No Content-Security-Policy, no anti-clickjacking protection, `X-Powered-By: Express` exposed, and unlimited request volume on every route including login and registration.
* **Current (Expected) Behavior:** A CSP with explicit `frame-ancestors`/`form-action` fallbacks, framework header suppressed, and two-tier rate limiting (a generous app-wide ceiling plus a strict one on auth-sensitive routes).