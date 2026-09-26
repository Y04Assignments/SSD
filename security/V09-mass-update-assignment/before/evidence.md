# BEFORE-FIX EVIDENCE: V09 — Mass Update Assignment 

**Vulnerability:** Mass Update Assignment leading to Unauthorized Field Modification
**OWASP Category:** A08:2021 – Software and Data Integrity Failures 
**Affected Component:** `PUT /api/products/:id`, `PUT /api/charging-stations/:id`
**Preconditions:** Authenticated as any user with update permission on the resource.

## Attack Description & Flow

1. An authenticated user sends an update request to `PUT /api/products/:id` (or the equivalent charging-station route).
2. The controller (`updateProduct` in `backend/src/controllers/productController.js`) builds the database update directly from the request body:
   ```javascript
   const updates = { ...req.body, name: ..., ... };
   ```
3. The charging-station controller (`updateChargingStation` in `backend/src/controllers/chargingStationController.js`) does the same, only excluding a handful of named fields:
   ```javascript
   const { latitude, longitude, connectors, photos, ...rest } = req.body;
   const updateData = { ...rest };
   ```
4. Neither handler restricts which fields of the schema can be set — any key in `req.body` that matches a field on the `Product` or `ChargingStation` Mongoose schema is written, including fields the client-side form never exposes.
5. The attacker adds an extra key (any other schema field not meant to be user-editable) to an otherwise normal-looking update payload, and it is silently persisted.

### 1. Update Request with Extra Field Injection

{
  "name": "Updated Name",
  "shortDescription": "A 100W monocrystalline solar panel for testing.",
  "fullDescription": "This is a placeholder product",
  "category": "Solar Panels",
  "price": 9.99,
  "rating": 5,
  "role": "admin",
  "createdBy": "000000000000000000000001"
}

### 2. Backend Response

{
    "message": "Product updated successfully",
    "product": {
        "_id": "6ab749a7cf5291816cc8d92b",
        "name": "Updated Name",
        "shortDescription": "A 100W monocrystalline solar panel for testing.",
        "fullDescription": "This is a placeholder product.",
        "category": "Solar Panels",
        "price": 9.99,
        "discount": 0,
        "rating": 5,
        "stockQuantity": 25,
        "availabilityStatus": "In Stock",
        "technicalSpecifications": {
            "wattage": "100W",
            "voltage": "12V"
        },
        "imageUrls": [
            "https://via.placeholder.com/400x300.png?text=Test+Product"
        ],
        "reviews": [],
        "createdBy": "000000000000000000000001",
        "createdAt": "2026-09-26T04:54:12.600Z",
        "updatedAt": "2026-09-26T05:07:42.424Z"
    }
}

### 3. Re-fetch Confirming Persistence

{
    "message": "Product updated successfully",
    "product": {
        "_id": "6ab749a7cf5291816cc8d92b",
        "name": "Updated Name",
        "shortDescription": "A 100W monocrystalline solar panel for testing.",
        "fullDescription": "This is a placeholder product.",
        "category": "Solar Panels",
        "price": 9.99,
        "discount": 0,
        "rating": 5,
        "stockQuantity": 25,
        "availabilityStatus": "In Stock",
        "technicalSpecifications": {
            "wattage": "100W",
            "voltage": "12V"
        },
        "imageUrls": [
            "https://via.placeholder.com/400x300.png?text=Test+Product"
        ],
        "reviews": [],
        "createdBy": "000000000000000000000001",
        "createdAt": "2026-09-26T04:54:12.600Z",
        "updatedAt": "2026-09-26T05:07:42.424Z"
    }
}

## Observed Result vs Expected Secure Result

* **Observed Result:** The extra field submitted in the request body was accepted and persisted to the database, even though it is not part of the product/station edit form. 
* **Expected Secure Result:** Update endpoints must only ever write an explicit allow-list of client-editable fields; any other key in the request body must be silently ignored regardless of what the client sends.

**Impact:** Any authenticated user (not just admins) can write to schema fields that were never intended to be client-editable, on any product or charging station they have update access to.
**Source Location:** `backend/src/controllers/productController.js` — `updateProduct()`; `backend/src/controllers/chargingStationController.js` — `updateChargingStation()`.
**Runtime Verification:** **PENDING — fill in the Postman evidence above, then change this line to "CONFIRMED RUNTIME"**
**Evidence Files:** `security/V09-mass-assignment-updates/before/evidence.md`