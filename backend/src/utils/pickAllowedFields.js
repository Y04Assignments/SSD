/**
 * Returns a new object containing ONLY the keys from `source` that are
 * listed in `allowedFields`. Any other key the client sent (rating,
 * totalRatings, createdBy, _id, __v, etc.) is silently dropped instead
 * of being passed through to the database.
 *
 * This is the fix for mass-assignment: instead of trusting the entire
 * request body, every update endpoint explicitly states which fields
 * a client is allowed to change.
 *
 * @param {Record<string, any>} source - the raw req.body (or any object)
 * @param {string[]} allowedFields - field names the caller may set
 * @returns {Record<string, any>} a new object with only the allowed keys copied over
 */
export const pickAllowedFields = (source, allowedFields) => {
    /** @type {Record<string, any>} */
  const result = {};
  if (!source || typeof source !== 'object') return result;

  for (const field of allowedFields) {
    // Only copy the key if the client actually sent it (so we don't
    // introduce `undefined` overwrites for fields the client omitted).
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = source[field];
    }
  }

  return result;
};