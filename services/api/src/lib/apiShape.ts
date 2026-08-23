/**
 * Response shaping for rows that used to be Mongo documents.
 *
 * The frontend is the contract, and it was written against Mongoose. It reads
 * `_id`, and it reads relations under the key that used to be populated -
 * `tripId` as an object, not `trip` beside a `tripId` string. Prisma returns
 * `id` and a foreign-key column, so a straight port silently changes every one
 * of those shapes.
 *
 * That is not a hypothetical. Before these helpers existed:
 *   - Wishlist.tsx keyed its list on `item._id` (undefined) and read
 *     `item.tripId.title` off a string.
 *   - PostCard.tsx called `post.likes.length` on a response that no longer had
 *     a `likes` array at all, which throws during render.
 *
 * So the API keeps speaking Mongo's shape while the storage underneath changes.
 * These helpers are the seam. They come out when the frontend is updated to read
 * `id`, and not before.
 */

/** Add `_id` beside `id`, so existing callers keep working. */
export function withMongoId<T extends { id: string }>(row: T): T & { _id: string } {
  return { ...row, _id: row.id };
}

export function withMongoIds<T extends { id: string }>(rows: T[]): (T & { _id: string })[] {
  return rows.map(withMongoId);
}

/**
 * Present a Mongo document the way `populate()` did: as an object carrying
 * `_id`, under the key the frontend already reads.
 */
export function asPopulated(doc: any): any {
  if (!doc) return null;
  const id = doc._id?.toString?.() ?? doc.id;
  return { ...doc, _id: id, id };
}

/**
 * Replace a foreign-key string with the populated document under the same key,
 * which is what Mongoose did. Returns a shallow copy.
 *
 *   populateKey(row, 'tripId', tripDoc)  ->  { ...row, tripId: { _id, title, ... } }
 */
export function populateKey<T extends Record<string, any>>(
  row: T,
  key: keyof T & string,
  doc: any
): T {
  return { ...row, [key]: asPopulated(doc) } as T;
}
