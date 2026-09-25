# AFTER-FIX EVIDENCE: V04 — Server-Side Request Forgery (SSRF)

## Vulnerability
**V04 — Server-Side Request Forgery in Product Image Resolver**  
**OWASP Category:** A10:2021 – Server-Side Request Forgery (SSRF)  
**CWE:** CWE-918: Server-Side Request Forgery (SSRF)

---

## Fix Applied
Implemented comprehensive multi-layer SSRF validation and safe HTTP transport in `backend/src/utils/ssrfValidator.js` and integrated it into `resolveProductImageUrl` within `backend/src/controllers/productController.js`:
1. **Protocol Restriction:** Enforces strict protocol validation permitting only `http:` and `https:`.
2. **Private & Reserved Range Rejection:** Detects and blocks loopback (`127.0.0.0/8`, `::1`), RFC 1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), Link-Local / Cloud Metadata (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), IPv6 Unique Local Addresses (`fc00::/7`, `fd00::/7`), and IPv4-mapped IPv6 representations (`::ffff:127.0.0.1`, `::ffff:7f00:1`).
3. **Internal Hostname Blocking:** Blocks internal and pseudo-top-level domains (`localhost`, `*.localhost`, `*.local`, `*.internal`, `*.test`).
4. **DNS Resolution Verification:** Resolves target hostnames via `dns.lookup` with all address records checked against prohibited IP subnets prior to socket connection.
5. **Hop-by-Hop Redirect Validation:** Created `safeFetch()` with manual redirect handling (`redirect: 'manual'`) validating destination IPs on each redirect hop (up to 3 hops) to prevent redirect-based SSRF bypasses.
6. **Extracted Content Verification:** Validates any extracted image URLs from HTML markup against SSRF constraints before returning them to clients.

---

## Source Changes
- `backend/src/utils/ssrfValidator.js`: Created SSRF protection utility with `isPrivateOrReservedIPv4`, `isPrivateOrReservedIPv6`, `validateSafeUrl`, and `safeFetch`.
- `backend/src/controllers/productController.js`: Updated `resolveProductImageUrl` to call `validateSafeUrl` for input URLs and extracted image URLs, and replaced native `fetch` with `safeFetch`.
- `backend/__tests__/ssrfValidator.test.js`: Added unit tests verifying SSRF prevention against private IPv4, IPv6, loopback, metadata, and internal hostnames.

---

## Retest Request

### Test 1: Loopback IPv4 Probe
```http
GET /api/products/resolve-image?url=http://127.0.0.1:8888/internal-probe HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <ADMIN_JWT_REDACTED>
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "message": "Prohibited or unsafe URL: Access to private, loopback, or reserved IP addresses is prohibited"
}
```
**Controlled Listener Status (`127.0.0.1:8888`):** Received **0** requests. Log remained completely empty.

### Test 2: Localhost Hostname Probe
```http
GET /api/products/resolve-image?url=http://localhost:8888/internal-probe HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <ADMIN_JWT_REDACTED>
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "message": "Prohibited or unsafe URL: Access to internal or local hostnames is prohibited"
}
```
**Controlled Listener Status (`127.0.0.1:8888`):** Received **0** requests.

### Test 3: Cloud Metadata IP Probe
```http
GET /api/products/resolve-image?url=http://169.254.169.254/latest/meta-data HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <ADMIN_JWT_REDACTED>
```

**Response:**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json; charset=utf-8

{
  "message": "Prohibited or unsafe URL: Access to private, loopback, or reserved IP addresses is prohibited"
}
```

### Test 4: Legitimate Public External URL
```http
GET /api/products/resolve-image?url=https://example.com/logo.png HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <ADMIN_JWT_REDACTED>
```

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "imageUrl": "https://example.com/logo.png",
  "sourceUrl": "https://example.com/logo.png",
  "resolved": false
}
```

---

## Previous Vulnerable Behavior
Before the fix, the backend made blind outbound HTTP HEAD and GET requests directly to internal addresses (`127.0.0.1:8888`), parsed the response body, and leaked internal content back to the caller.

## Current Behavior
Any attempt to target loopback, private, link-local, cloud metadata, or internal hostnames is intercepted and rejected with HTTP 400 before establishing a connection. The controlled internal listener receives zero traffic. Legitimate public external URLs continue to function normally.

## Expected Secure Behavior
Requests to internal, private, loopback, and metadata destinations must be blocked without sending network traffic to internal systems. Public internet URLs must be safely permitted.

## Result
**PASS**

---

## Regression Test
- Ran full backend test suite (`npm test`): 12 test suites, 71 tests passing (including 13 new dedicated SSRF validation tests).
- Verified legitimate external URL preview resolution continues to function.

---

## Commit
- **Commit Hash:** `fd26f80`
- **Commit Message:** `fix(security): prevent SSRF in product image resolver`
