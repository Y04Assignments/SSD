# BEFORE-FIX EVIDENCE: V10 — JWT Stored in `localStorage`

**Vulnerability:** Sensitive session token stored in a location readable by any JavaScript on the page
**OWASP Category:** A02:2021 – Cryptographic Failures 
**Affected Component:** `client/src/context/AuthContext.jsx`, `POST /api/users/login`
**Preconditions:** None to observe the flaw directly; exploitation requires one XSS bug anywhere in the app, a malicious browser extension, or physical/malware access to an unlocked, logged-in browser.


## Attack Description & Flow

1. A user logs in normally via `POST /api/users/login`. The JWT is returned only in the JSON response body — no cookie is set.
2. The frontend's `login()` function writes the raw JWT string directly into `localStorage`:
   ```jsx
   const login = (token, userData) => {
     console.log('AuthContext: Logging in user', userData);
     localStorage.setItem('token', token);
     localStorage.setItem('user', JSON.stringify(userData));
     setToken(token);
     setUser(userData);
   };
   ```
3. On every page load, the token is read back out of `localStorage`:
   ```jsx
   useEffect(() => {
     const storedToken = localStorage.getItem('token');
     const storedUser = localStorage.getItem('user');
     if (storedToken && storedUser) {
       setToken(storedToken);
       setUser(JSON.parse(storedUser));
     }
   }, []);
   ```
4. `localStorage` has no `httpOnly`-equivalent protection — any JavaScript running on the page's origin can read it, and the token persists for up to 30 days regardless of reloads or browser restarts.
5. A stolen token can be replayed directly against any protected API route (`Authorization: Bearer <stolen_token>`) with no further authentication required.

### 1. Login Request

{
  "email": "test@gmail.com",
  "password": "123456"
}

### 2. Login Response

Result
{
    "success": true,
    "message": "Login successful",
    "data": {
        "user": {
            "id": "6ab74ce6b38b0949c03e3c8b",
            "email": "test@gmail.com",
            "role": "admin",
            "isEmailVerified": true
        },
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYjc0Y2U2YjM4YjA5NDljMDNlM2M4YiIsImlhdCI6MTc5MDM5OTQwNywiZXhwIjoxNzkyOTkxNDA3fQ.Z1XHubdxJJuBi3wXGRYTIncZh9yGE571zd8Q-MTjNNU"
    }
}

## Observed Result vs Expected Secure Result

* **Observed Result:** login response contains the token in plain JSON, `localStorage` holds the raw token after login, and replaying that token from an entirely separate client (Postman) fully authenticates. 
* **Expected Secure Result:** The token should never be placed anywhere ordinary page JavaScript can read it; it should be set as an `httpOnly` cookie so only the server and the browser's cookie-handling machinery can access it.

**Impact:** Any XSS bug anywhere in the application, a malicious browser extension, or brief device access results in full, silent, long-lived account takeover, replayable from any external client.
**Source Location:** `client/src/context/AuthContext.jsx` — `login()` and the session-restore `useEffect`.