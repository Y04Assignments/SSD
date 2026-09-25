# AFTER-FIX EVIDENCE: V07 — Public PII + Exact Residential Geolocation Exposure

## Vulnerability
**V07 — Public PII and Exact Residential Geolocation Exposure**  
**OWASP Category:** A01:2021 – Broken Access Control / Sensitive Data Exposure  
**CWE:** CWE-200: Exposure of Sensitive Information to an Unauthorized Actor, CWE-359: Exposure of Private Personal Information

---

## Fix Applied
Applied data minimization and privacy-preserving coordinate generalization to the public map endpoint `getActiveSellRequests` in `backend/src/controllers/sellRequestController.js`:
1. **Omission of PII & Internal Identifiers:** Completely removed the `populate('resident', 'name email')` query and stripped the `resident` object from the public response. Internal resident database User IDs, personal names, and private email addresses are never returned to unauthenticated consumers.
2. **Seller Identity Anonymization:** Replaced client-derivable email handles with an anonymized public label (`Solar Seller #<suffix>`) based strictly on non-sensitive sell request IDs.
3. **Coordinate Generalization / Fuzzing:** Implemented geographic coordinate rounding to 2 decimal places (`Math.round(coord * 100) / 100`). This fuzzes coordinates to ~1.1 km resolution, obscuring specific home/rooftop addresses while maintaining functional utility for general neighborhood map navigation.
4. **Strict Projection:** Database query projects only required public fields (`energyAmount`, `location`, `comment`, `status`, `createdAt`) with `.lean()` execution.

---

## Source Changes
- `backend/src/controllers/sellRequestController.js`: Updated `getActiveSellRequests` to exclude the `resident` model reference, anonymize the seller username, and round GPS coordinates before returning public response JSON.

---

## Retest Request

### Controlled Test Data
A sell request was created by user `v07_resident_privacy@solarcharge.local` (User ID: `6ab6f06d0829a8fd72291243`) with exact residential coordinates:
- Exact Coordinates: `[79.861244, 6.927079]` (Colombo residential district)
- Sell Request ID: `6ab6f06d0829a8fd72291246`

### Anonymous Map Request
```http
GET /api/sell-request/map HTTP/1.1
Host: 127.0.0.1:5001
```

### Server Response
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{
  "message": "Active sell requests retrieved successfully",
  "requests": [
    {
      "_id": "6ab6f06d0829a8fd72291246",
      "username": "Solar Seller #1246",
      "energyAmount": 45,
      "location": {
        "type": "Point",
        "coordinates": [
          79.86,
          6.93
        ]
      },
      "comment": "Private residential solar rooftop - test seller",
      "status": "Pending",
      "createdAt": "2026-09-25T22:06:37.480Z"
    }
  ]
}
```

### Verification Findings
| Verification Check | Target Field | Result | Status |
|---|---|---|---|
| Seller Email Exposure | `resident.email` | Stripped completely; email absent from JSON | PASS |
| Internal User ID Exposure | `resident._id` | Stripped completely; user ID absent from JSON | PASS |
| Exact Geolocation Exposure | `location.coordinates` | Generalized to `[79.86, 6.93]` (~1.1 km fuzzing) | PASS |
| Public Seller Handle | `username` | Anonymized to `Solar Seller #1246` | PASS |
| Authenticated User Requests | `getUserSellRequests` | Unaffected; protected and scoped to owner | PASS |

---

## Previous Vulnerable Behavior
Unauthenticated requests returned the seller's full email address (`test_admin@test.com`), internal Mongo User ID (`resident._id`), and exact rooftop GPS coordinates (`[79.8612, 6.9271]`), enabling physical tracking and doxing of residential solar owners.

## Current Behavior
The public endpoint returns only sanitized, minimized data. The `resident` object is omitted, seller names are anonymized, and GPS coordinates are fuzzed to neighborhood-level precision.

## Expected Secure Behavior
No personal identifiable information (emails, user IDs) or exact residential coordinates may be exposed on public unauthenticated endpoints.

## Result
**PASS**

---

## Regression Test
- Ran full backend test suite (`npm test`): 12 test suites, 71 tests passing.
- Verified authenticated endpoint `GET /api/sell-request/my-requests` continues to allow sellers to manage their own sell requests.

---

## Commit
- **Commit Hash:** `843b1af` (earlier local iteration: `fe18196`)
- **Commit Message:** `fix(security): minimize public sell request location data`
