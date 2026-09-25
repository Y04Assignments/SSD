# AFTER-FIX EVIDENCE: V08 — Regex Injection / Query Disruption

## Vulnerability
**V08 — Regex Injection / Query Disruption in Station Search**  
**OWASP Category:** A03:2021 – Injection  
**CWE:** CWE-1333: Inefficient Regular Expression Complexity, CWE-20: Improper Input Validation

---

## Fix Applied
Implemented regex metacharacter escaping in `backend/src/controllers/stationController.js`:
1. **Dedicated Sanitization Function:** Added `escapeRegex(str)` that transforms user-supplied strings by escaping all regular expression control characters: `.` `*` `+` `?` `^` `$` `{` `}` `(` `)` `|` `[` `]` `\`.
   ```javascript
   export const escapeRegex = str => {
     if (typeof str !== 'string') return '';
     return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   };
   ```
2. **Literal Text Enforcement:** Applied `escapeRegex()` to `search` and `district` query parameters before compiling them into `new RegExp(..., 'i')` in both `searchStations` and `distanceSearchStations`.
3. **Prevention of Query Disruption:** Because input is escaped, malformed regex syntax (such as unclosed character classes `[` or unclosed groups `(`) is safely escaped as literal `\[` and `\(` and cannot cause V8 `SyntaxError` or trigger HTTP 500 crashes.
4. **ReDoS Immunity:** Catastrophic backtracking patterns (e.g. `^((a+)+)+$`) are escaped as literal text, preventing regex engine denial of service.

---

## Source Changes
- `backend/src/controllers/stationController.js`: Added `escapeRegex()` helper and applied it to `searchRegex` and `districtRegex` in `searchStations` and `distanceSearchStations`.

---

## Retest Request

Tested station search endpoint across representative inputs:

| Test Case | Parameter | HTTP Status | Response Time | Matches Found | Result |
|---|---|---|---|---|---|
| Normal Text | `search=Colombo` | 200 OK | 19.04 ms | 1 (Expected match) | PASS |
| Unclosed Bracket (Previous Crash) | `search=%5B` (`[`) | 200 OK | 2.80 ms | 1 (Literal `[` in station name) | PASS |
| Regex Wildcard | `search=.*` | 200 OK | 1.72 ms | 0 (Treated literally) | PASS |
| Catastrophic Pattern | `search=%5E((a%2B)%2B)%2B%24` (`^((a+)+)+$`) | 200 OK | 1.45 ms | 0 (No ReDoS / no hang) | PASS |
| Unescaped Quantifier | `search=%2B` (`+`) | 200 OK | 2.12 ms | 0 (Treated literally) | PASS |
| Unmatched Group | `search=(` | 200 OK | 1.31 ms | 0 (No syntax error) | PASS |
| Backslash | `search=%5C` (`\`) | 200 OK | 1.21 ms | 0 (No syntax error) | PASS |
| Literal Search with Brackets | `search=%5BBracket%5D` (`[Bracket]`) | 200 OK | 3.72 ms | 1 (Matches `Special [Bracket] Station`) | PASS |

### Sample Response for Previous Crash Payload (`search=[`)
```http
GET /api/stations/search?search=%5B HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

[
  {
    "_id": "6ab6f1200829a8fd72291248",
    "name": "Special [Bracket] Station",
    "district": "Kandy",
    "city": "Kandy",
    "address": "45 Lake Round, Kandy",
    "location": {
      "type": "Point",
      "coordinates": [80.6337, 7.2906]
    },
    "status": "Open",
    "connectors": [
      {
        "type": "TYPE1",
        "totalSlots": 2,
        "availableSlots": 1,
        "powerKW": 22
      }
    ]
  }
]
```

---

## Previous Vulnerable Behavior
Submitting `search=[` resulted in an unhandled V8 `SyntaxError: Invalid regular expression: /[/i: Unterminated character class`, aborting the request and returning `HTTP 500 Internal Server Error` with stack traces in the server log.

## Current Behavior
Every special regular expression metacharacter is automatically escaped before passing into `new RegExp()`. Input is evaluated as literal text. Malformed regex syntax returns `HTTP 200 OK` with accurate literal search results without crashing or throwing errors.

## Expected Secure Behavior
User input must be treated as literal text. Metacharacters must not break server-side regex evaluation or cause HTTP 500 errors.

## Result
**PASS**

---

## Regression Test
- Ran full backend test suite (`npm test`): 12 test suites, 71 tests passing (including `stationSearchFilter.test.js` and `stationController.test.js`).
- Verified normal station searches by name, address, and connector type remain fully functional.

---

## Commit
- **Commit Hash:** `d107917` (earlier local iteration: `98a59fe`)
- **Commit Message:** `fix(security): escape user input in station search regex`
