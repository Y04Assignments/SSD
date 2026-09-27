# AFTER-FIX EVIDENCE: V10 — JWT Stored in `localStorage`

**Vulnerability:** V10 — Session token stored in `localStorage`, readable by any page JavaScript
**Fix Applied:** The JWT is now also set as an `httpOnly` cookie at login. The frontend no longer writes the token to `localStorage` at all — it is kept only in React memory for the active tab and silently restored on page load via a new `GET /api/users/session` endpoint that reads the `httpOnly` cookie server-side.

## Source Changes

* `backend/app.js` — added `cookie-parser` middleware.
* `backend/src/controllers/userController.js` — `login()` now calls:
  ```javascript
  res.cookie('token', token, { httpOnly: true, secure, sameSite: 'lax' });
  ```
  Added `getSessionFromCookie()` and `logoutUser()`.
* `backend/src/routes/userRoutes.js` — added `GET /api/users/session` and `POST /api/users/logout` routes.
* `client/src/context/AuthContext.jsx` — removed all `localStorage.getItem/setItem/removeItem('token'|'user')` calls and all `console.log` calls; `login()` keeps the token only in React state; a `useEffect` on mount calls `/api/users/session` to restore it.
* `client/src/main.jsx` — added `axios.defaults.withCredentials = true` so the `httpOnly` cookie is sent automatically.

### 1. Login Request

{
  "email": "test@gmail.com",
  "password": "123456"
}

### 2. Login Response — note the `Set-Cookie` header

set-cookie
token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhYjc0Y2U2YjM4YjA5NDljMDNlM2M4YiIsImlhdCI6MTc5MDQyNTAzNSwiZXhwIjoxNzkzMDE3MDM1fQ.bbFctBZvQwPHJuEhM5IFgWsxV1DZqsNCKNwoa_4AyGw; Max-Age=2592000; Path=/; Expires=Mon, 26 Oct 2026 12:17:15 GMT; HttpOnly; SameSite=Lax

### 3. Logout Clearing the Cookie

set-cookie
token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT

## Comparison: Previous Vulnerable vs Current (Expected) Behavior

* **Previous Vulnerable Behavior:** Full JWT sitting in plain text in `localStorage`, retrievable by any script on the page, persisting for up to 30 days regardless of reloads.
* **Current (Expected) Behavior:** The token exists only as an `httpOnly` cookie (invisible to `document.cookie` and any injected script) and in React memory for the current tab, safely re-derived from the cookie on reload.

Components that manually attach `Authorization: Bearer <token>` headers still read `token` from React context during the active session — that part of the app's request pattern is unchanged. This fix closes the persistent, cross-reload, indefinitely-readable storage of the token; migrating every component to cookie-only requests is listed as future work, not claimed as done here.