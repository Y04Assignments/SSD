# BEFORE-FIX EVIDENCE: V07 — PII & Residential Geolocation Exposure

**Vulnerability:** Unauthenticated Exposure of Private Resident Emails and Exact GPS Geolocation  
**OWASP Category:** A01:2021 – Broken Access Control / Sensitive Data Exposure  
**Affected Component:** `GET /api/sell-request/map`  
**Preconditions:** An active pending sell request in the database  

---

## Attack Description & Flow

1. Registered residents list excess residential solar energy for sale via `POST /api/sell-request`.
2. The listing includes the seller's user ID (`resident`), energy quantity, private personal comments, and exact residential latitude/longitude coordinates (`location.coordinates`).
3. To display offers on the frontend map, `backend/src/routes/sellRequestRoutes.js:14` exposes an unauthenticated endpoint:
   ```javascript
   router.get('/map', getActiveSellRequests);
   ```
4. In `backend/src/controllers/sellRequestController.js:4-26`:
   ```javascript
   export const getActiveSellRequests = async (req, res) => {
     const rawRequests = await SellRequest.find({ status: 'Pending' })
       .sort({ createdAt: -1 })
       .select('resident energyAmount location comment status createdAt')
       .populate('resident', 'name email');

     const requests = rawRequests.map(request => ({
       _id: request._id,
       username,
       resident: request.resident,
       energyAmount: request.energyAmount,
       location: request.location,
       comment: request.comment,
       status: request.status,
       createdAt: request.createdAt,
     }));
   ```
5. `resident: request.resident` preserves the entire populated user object (`_id`, `name`, and `email`), and `location` contains exact floating-point GPS coordinates `[longitude, latitude]`.
6. Any anonymous internet scraper can poll `GET /api/sell-request/map` and compile a database mapping physical home addresses to personal email addresses and home solar setups.

---

## Runtime Verification Logs

### 1. Test Data Setup: Creating an Energy Offer with Residential Coordinates

Using a test account, an offer with residential coordinates `[79.8612, 6.9271]` was submitted:

```http
POST /api/sell-request HTTP/1.1
Host: 127.0.0.1:5001
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "energyAmount": 45,
  "location": {
    "type": "Point",
    "coordinates": [79.8612, 6.9271]
  },
  "comment": "Private residential solar rooftop - test seller"
}

HTTP/1.1 201 Created
{"message":"Sell request created successfully", ...}
```

### 2. Unauthenticated Anonymous Map Query

Calling `GET /api/sell-request/map` without any authentication headers or cookies:

```http
GET /api/sell-request/map HTTP/1.1
Host: 127.0.0.1:5001

HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: application/json; charset=utf-8

{
  "message": "Active sell requests retrieved successfully",
  "requests": [
    {
      "_id": "6ab6e8845e89b106943f7a94",
      "username": "test_admin",
      "resident": {
        "_id": "6ab6e7795e89b106943f7a94",
        "name": null,
        "email": "test_admin@test.com"
      },
      "energyAmount": 45,
      "location": {
        "type": "Point",
        "coordinates": [
          79.8612,
          6.9271
        ]
      },
      "comment": "Private residential solar rooftop - test seller",
      "status": "Pending",
      "createdAt": "2026-09-25T21:32:52.141Z"
    }
  ]
}
```

Exposed fields:
* `resident.email` (`"test_admin@test.com"`)
* `resident._id` (`"6ab6e7795e89b106943f7a94"`)
* `location.coordinates` (`[79.8612, 6.9271]`)
* `comment` (`"Private residential solar rooftop - test seller"`)

---

## Observed Result vs Expected Secure Result

* **Observed Result:** Full personal email addresses, user IDs, and precise residential GPS coordinates are exposed to unauthenticated callers.
* **Expected Secure Result:** Public map APIs must only disclose anonymized metadata (e.g. non-identifying seller handle); coordinates must be fuzzed or truncated to neighborhood/city level to protect physical home privacy; direct resident email addresses must never be exposed publicly.

**Impact:** Severe privacy violation, physical tracking/doxing of home owners, targeted phishing, and physical theft risk.  
**Source Location:** `backend/src/controllers/sellRequestController.js:4-26`, `backend/src/routes/sellRequestRoutes.js:14`.  
**Runtime Verification:** **CONFIRMED RUNTIME**  
**Evidence Files:** `security/V07-pii-geolocation/before/evidence.md`
