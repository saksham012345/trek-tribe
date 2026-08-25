import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Creating an organizer's initial verification request, exactly once.
 *
 * Two paths create one: auth.service.ts on registration, which looked for an
 * existing request first, and the Google OAuth branch of routes/auth.ts, which
 * did not. Only one of the two was careful, so an organizer arriving through
 * Google accumulated a request per sign-in.
 *
 * src/scripts/fix-duplicates.ts existed to clean that up afterwards - group by
 * organizerId, find the ones with more than one, pick a survivor by a priority
 * ordering, delete the rest. A script that deletes duplicates is a constraint
 * nobody wrote down.
 *
 * It is written down now, as a partial unique index:
 *
 *     CREATE UNIQUE INDEX ... ON verification_requests (organizer_id)
 *       WHERE request_type = 'initial'
 *
 * Partial, because requestType matters - an organizer has one 'initial' request
 * but may legitimately submit 'kyc_update' or 're_verification' more than once.
 * A total unique on (organizer_id, request_type) would have blocked the two
 * that are supposed to repeat.
 *
 * Prisma cannot express a partial index, so it is hand-written SQL in the
 * migration and Prisma does not know it exists - which is why this is a create
 * with a P2002 branch rather than an upsert. `upsert` needs a unique Prisma can
 * name, and this one it cannot.
 */
export async function createInitialVerificationRequest(details: {
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  phone?: string;
  businessName?: string;
}): Promise<{ created: boolean }> {
  try {
    await prisma.verificationRequest.create({
      data: {
        organizerId: details.organizerId,
        organizerName: details.organizerName,
        organizerEmail: details.organizerEmail,
        requestType: 'initial',
        status: 'pending',
        priority: 'medium',
        phone: details.phone || null,
        businessName: details.businessName || null
      }
    });
    return { created: true };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Already has one. This is the normal case for a returning organizer, not
      // an error - which is what the careful path was expressing with its
      // find-first, and what the other path was missing.
      return { created: false };
    }
    logger.error('Failed to create verification request', {
      organizerId: details.organizerId,
      error: error?.message
    });
    throw error;
  }
}
