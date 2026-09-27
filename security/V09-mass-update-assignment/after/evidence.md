# AFTER-FIX EVIDENCE: V09 — Mass Update Assignment 

**Vulnerability:** V09 — Mass update assignment via unrestricted `req.body` spreading
**Fix Applied:** Introduced a shared `pickAllowedFields()` helper and explicit `PRODUCT_EDITABLE_FIELDS` / `STATION_EDITABLE_FIELDS` allow-lists; both controllers now build their update object exclusively from the whitelisted fields instead of spreading `req.body`/`rest` directly.

## Source Changes

* `backend/src/utils/pickAllowedFields.js` — **new file.**
  ```javascript
  export const pickAllowedFields = (source, allowedFields) => {
    const result = {};
    if (!source || typeof source !== 'object') return result;
    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(source, field)) {
        result[field] = source[field];
      }
    }
    return result;
  };
  ```
* `backend/src/controllers/productController.js` — added `PRODUCT_EDITABLE_FIELDS` array; `updateProduct()` now does:
  ```javascript
  const updates = pickAllowedFields(req.body, PRODUCT_EDITABLE_FIELDS);
  ```
* `backend/src/controllers/chargingStationController.js` — added `STATION_EDITABLE_FIELDS` array; `updateChargingStation()` now does:
  ```javascript
  const updateData = pickAllowedFields(req.body, STATION_EDITABLE_FIELDS);
  ```

  ### 1. Update Request with the Same Extra Field
  {
  "name": "Updated Name",
  "shortDescription": "A 100W monocrystalline solar panel for testing.",
  "fullDescription": "This is a placeholder product created directly in MongoDB Compass for Postman security testing. Not a real listing.",
  "category": "Solar Panels",
  "price": 9.99,
  "rating": 4.8,
  "role": "admin",
  "createdBy": "000000000000000000000007"
}

### 2. Backend Response
{
    "message": "Product updated successfully",
    "product": {
        "_id": "6ab749a7cf5291816cc8d92b",
        "name": "Updated Name",
        "shortDescription": "A 100W monocrystalline solar panel for testing.",
        "fullDescription": "This is a placeholder product created directly in MongoDB Compass for Postman security testing. Not a real listing.",
        "category": "Solar Panels",
        "price": 9.99,
        "discount": 0,
        "rating": 4.25,
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
        "createdBy": "000000000000000000000005",
        "createdAt": "2026-09-26T04:54:12.600Z",
        "updatedAt": "2026-09-26T08:41:16.576Z"
    }
}

### 3. Re-fetch Confirming the Field Was NOT Persisted

{
    "message": "Product updated successfully",
    "product": {
        "_id": "6ab749a7cf5291816cc8d92b",
        "name": "Updated Name",
        "shortDescription": "A 100W monocrystalline solar panel for testing.",
        "fullDescription": "This is a placeholder product created directly in MongoDB Compass for Postman security testing. Not a real listing.",
        "category": "Solar Panels",
        "price": 9.99,
        "discount": 0,
        "rating": 4.25,
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
        "createdBy": "000000000000000000000005",
        "createdAt": "2026-09-26T04:54:12.600Z",
        "updatedAt": "2026-09-26T08:41:16.576Z"
    }
}

## Comparison: Previous Vulnerable vs Current (Expected) Behavior

* **Previous Vulnerable Behavior:** Any key in `req.body` matching a schema field name was written to the database.
* **Current (Expected) Behavior:** Only fields named in the explicit `PRODUCT_EDITABLE_FIELDS` / `STATION_EDITABLE_FIELDS` allow-lists can ever be written, regardless of what else is in the request body.