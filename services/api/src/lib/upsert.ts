/**
 * Prisma's `upsert` is not atomic.
 *
 * It issues a SELECT and then an INSERT or an UPDATE. Two callers arriving at
 * the same moment for a key that does not exist yet both find nothing, both
 * INSERT, and one of them loses on the unique index with P2002. The upsert
 * protects the sequential case - "a row already exists, update it instead of
 * colliding" - and nothing else.
 *
 * That distinction is easy to miss, and it matters here because the sequential
 * case is exactly the bug wave 7 set out to fix: subscription code that did
 * findOne-then-create and blew up on an organizer who already had a row. Fixing
 * that with `upsert` fixes the common case and leaves a narrower one behind.
 *
 * This closes it. On P2002 the operation is retried once: the row is there now,
 * so the second attempt takes the update branch and succeeds. One retry is
 * enough - the conflict can only happen while the row does not exist, and after
 * the first attempt it does.
 *
 * Found by the wave 7 test that calls canCreateTrip twice concurrently. Without
 * the retry, two trip-creation requests arriving together from an organizer with
 * no subscription meant one of them got a 500.
 */
export async function upsertRacingSafely<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return await operation();
    }
    throw error;
  }
}
