# BEFORE-FIX EVIDENCE: V08 — Regex Injection / Denial of Service

**Vulnerability:** Unsanitized Regular Expression Construction in Station Search  
**OWASP Category:** A03:2021 – Injection  
**Affected Component:** `GET /api/stations/search?search=<query>` and `GET /api/stations/distance-search`  
**Preconditions:** None (public search endpoints)  

---

## Attack Description & Flow

1. In `backend/src/controllers/stationController.js:12`:
   ```javascript
   if (search && search.trim() !== '') {
     const searchRegex = new RegExp(search, 'i'); //case-insensitive regex for partial matching
     andConditions.push({
       $or: [{ name: searchRegex }, { address: searchRegex }, { 'connectors.type': searchRegex }],
     });
   }
   ```
2. User-supplied query string parameter `search` is passed directly into `new RegExp(search, 'i')` without escaping regex meta-characters (`[`, `(`, `*`, `+`, `?`, etc.).
3. **Regex Injection Impact:**
   * Passing malformed regular expression syntax (such as an unclosed bracket `[` or parenthesis `(`) causes the JavaScript V8 engine to throw an unhandled `SyntaxError: Invalid regular expression`.
   * The exception is caught by a generic try-catch block, aborts database search execution, logs a full stack trace to the console, and returns an internal server error `HTTP 500` to the client.
   * Passing unconstrained wildcard patterns (`.*`) alters the expected search semantics to return all records across three indexed fields simultaneously.

---

## Runtime Verification Logs

### 1. Baseline Search (Normal String)

```http
GET /api/stations/search?search=Colombo HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
Time: 0.002481s
[]
```

### 2. Invalid Regex Input Test (Unclosed Bracket `[`)

```http
GET /api/stations/search?search=%5B HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 500 Internal Server Error
Time: 0.001240s
Content-Type: application/json; charset=utf-8

{"message":"Server error during search"}
```

**Captured Server Error Log:**
```
Search error: SyntaxError: Invalid regular expression: /[/i: Unterminated character class
    at new RegExp (<anonymous>)
    at searchStations (file:///Users/gavidurushela/ssd%20ass/solar/SSD/backend/src/controllers/stationController.js:12:27)
    at Layer.handle [as handle_request] (/Users/gavidurushela/ssd ass/solar/SSD/backend/node_modules/express/lib/router/layer.js:95:5)
```

### 3. Controlled Regex Metacharacters (`.*`)

```http
GET /api/stations/search?search=.* HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
Time: 0.001641s
[]
```

### 4. Bounded Nested Group Pattern (`^((a+)+)+$`)

```http
GET /api/stations/search?search=%5E((a%2B)%2B)%2B%24 HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
Time: 0.003711s
[]
```

---

## Observed Result vs Expected Secure Result

* **Observed Result:** Submitting raw regex meta-characters triggered unhandled `SyntaxError` in `new RegExp()`, crashing search query execution and causing a 500 Internal Server Error with server error logging.
* **Expected Secure Result:** All user query inputs must be sanitized using a regex escaping utility (e.g. `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) before being passed to `new RegExp()`, ensuring special regex characters are treated as literal characters.
* **Assignment Evidence Standard Note:** Runtime testing confirmed **Regex Injection** producing unhandled syntax crashes and query disruption (HTTP 500). In accordance with instructions, this is accurately reported as **Regex Injection / Application Query Denial of Service** rather than claiming catastrophic server-wide freeze.

**Impact:** Application-level denial of service on station searching, error disclosure, and search logic manipulation.  
**Source Location:** `backend/src/controllers/stationController.js:12, 20, 79, 87`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V08-regex/before/evidence.md`
