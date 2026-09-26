# BEFORE-FIX EVIDENCE: V11 — Missing Security Headers / No Rate Limiting

**Vulnerability:** Missing HTTP security headers (CSP, anti-clickjacking, MIME-sniffing protection) and no rate limiting on any API route
**OWASP Category:** A05:2021 – Security Misconfiguration 
**Affected Component:** `backend/app.js` (entire application — no `helmet` or `express-rate-limit` middleware present anywhere in the codebase)
**Preconditions:** None — this is passively observable on any request to the app.

## Attack Description & Flow

1. Every response from the backend omits `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, and `X-Content-Type-Options`, while still exposing `X-Powered-By: Express`.
2. Confirmed by source inspection — no `helmet` or `express-rate-limit` import exists anywhere:
   ```bash
   grep -rn "helmet\|rateLimit\|rate-limit" backend/*.js backend/src 2>/dev/null
   # (no output)
   grep -i "helmet\|rate-limit\|express-rate" backend/package.json
   # (no output — neither package is even listed as a dependency)
   ```
3. This was independently confirmed with a real OWASP ZAP dynamic scan (ZAP 2.17.0) against the live app.
4. Because there is no rate limiting on `/login`, `/register`, `/forgot-password`, or `/reset-password`, nothing stops an attacker from scripting unlimited credential-stuffing or brute-force attempts against these endpoints.

### 1. Header Inspection Request

{
    "email": "nobody@test.com",
    "password": "wrong"
}

### 2. Rate Limit Proof-of-Concept (Collection Runner, 20 iterations)
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
Iteration 11: 401
Iteration 12: 401
Iteration 13: 401
Iteration 14: 401
Iteration 15: 401
Iteration 16: 401
Iteration 17: 401
Iteration 18: 401
Iteration 19: 401
Iteration 20: 401

## Observed Result vs Expected Secure Result

* **Observed Result:** Response headers omit CSP/anti-clickjacking/MIME-sniffing protection and expose `X-Powered-By`; 20 rapid login attempts all return 401 with none throttled. 
* **Expected Secure Result:** Every response should carry a restrictive CSP, `X-Content-Type-Options: nosniff`, and an anti-clickjacking control; framework-identifying headers should be suppressed; authentication-sensitive routes should be rate-limited per client.

**Impact:** Enables clickjacking/UI-redress attacks against login and other flows, framework fingerprinting for targeted exploitation, and unthrottled automated credential stuffing / brute-force against authentication endpoints.
**Source Location:** `backend/app.js` (missing middleware registration, entire file).