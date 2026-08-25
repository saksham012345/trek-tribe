import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

/**
 * Joining and leaving a trip.
 *
 * `Trip.participants` was an array of ObjectIds, and everything that touched it
 * went through the same three lines:
 *
 *     const currentParticipants = trip.participants.length;
 *     const availableSpots = trip.capacity - currentParticipants;
 *     if (availableSpots < numberOfTravelers) throw ...
 *     // ... later ...
 *     trip.participants.push(userId);
 *     await trip.save();
 *
 * Two people booking the last seat both read the same length, both find a spot
 * free, and both are added. The trip is then over capacity, and nothing ever
 * notices - capacity is only ever compared, never enforced.
 *
 * Three separate bugs lived in that array, and all three are gone here:
 *
 *   1. **Overbooking.** joinTrip locks the trip row before counting, so the
 *      count a caller sees is a count no other caller can change until it has
 *      finished. Concurrent bookings queue instead of racing.
 *
 *   2. **Duplicate participants.** The guard against adding someone twice was
 *      `trip.participants.includes(userId)` - an ObjectId array tested with
 *      SameValueZero. An ObjectId is never equal to a string and two ObjectId
 *      instances are never equal to each other, so the guard was false every
 *      time and every payment verification appended the same person again.
 *      `@@unique([tripId, userId])` makes the second insert impossible.
 *
 *   3. **Members who could not see their own booking.** The same `includes`
 *      expression was the membership test in cancelBookingByTripId and
 *      getBookingDetailsByTripId, so both said no to everyone. `isParticipant`
 *      compares two strings.
 */

export class TripFullError extends Error {
  constructor(public available: number, public requested: number, public capacity: number) {
    super(`Not enough spots available. Only ${available} spots remaining`);
    this.name = 'TripFullError';
  }
}

export async function participantCount(tripId: string): Promise<number> {
  return prisma.tripParticipant.count({ where: { tripId } });
}

/** Was `trip.participants.includes(userId)`, which was false for everyone. */
export async function isParticipant(tripId: string, userId: string): Promise<boolean> {
  const row = await prisma.tripParticipant.findUnique({
    where: { tripId_userId: { tripId, userId } },
    select: { id: true }
  });
  return row !== null;
}

/**
 * Add a participant, refusing to exceed capacity.
 *
 * `SELECT ... FOR UPDATE` on the trip is what makes the capacity check mean
 * something. Postgres holds the row until the transaction ends, so a second
 * booking for the same trip waits, then counts again and sees the first one.
 *
 * Read Committed alone is not enough here: without the lock, both transactions
 * would read the same count, both would pass the check, and both would insert -
 * the unique constraint would not stop them, because they are different users.
 *
 * The lock is per trip, so bookings for different trips never wait on each
 * other.
 */
export async function joinTrip(
  tripId: string,
  userId: string,
  details: {
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    medicalConditions?: string;
    dietaryRestrictions?: string;
    experienceLevel?: 'beginner' | 'intermediate' | 'advanced';
    specialRequests?: string;
  } = {},
  seats = 1
): Promise<{ joined: boolean; alreadyJoined: boolean; participants: number }> {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ capacity: number }>>`
      SELECT capacity FROM trips WHERE id = ${tripId} FOR UPDATE
    `;

    if (locked.length === 0) {
      throw Object.assign(new Error('Trip not found'), { status: 404 });
    }

    const capacity = locked[0].capacity;
    const taken = await tx.tripParticipant.count({ where: { tripId } });

    const existing = await tx.tripParticipant.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { id: true }
    });

    if (existing) {
      return { joined: false, alreadyJoined: true, participants: taken };
    }

    const available = capacity - taken;
    if (available < seats) {
      throw new TripFullError(available, seats, capacity);
    }

    await tx.tripParticipant.create({
      data: { tripId, userId, ...details }
    });

    return { joined: true, alreadyJoined: false, participants: taken + 1 };
  });
}

/**
 * Remove a participant.
 *
 * The Mongoose version filtered the array with `id.toString() !== userId`,
 * which - unlike the three `includes` calls in the same file - was correct.
 */
export async function leaveTrip(tripId: string, userId: string): Promise<boolean> {
  const removed = await prisma.tripParticipant.deleteMany({
    where: { tripId, userId }
  });
  return removed.count > 0;
}

/**
 * Add a participant after a payment is verified, where being already added is
 * the expected case rather than an error.
 *
 * This is the path that was appending a duplicate on every verification. It
 * deliberately does not check capacity: the seat was paid for, and refusing it
 * here would take money without giving a place. If it puts the trip over
 * capacity that is worth knowing about, so it is logged.
 */
export async function addPaidParticipant(tripId: string, userId: string): Promise<void> {
  try {
    await prisma.tripParticipant.create({ data: { tripId, userId } });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Already a participant. Before the unique constraint this branch was
      // unreachable and the row was added again.
      return;
    }
    throw error;
  }

  const [trip, taken] = await Promise.all([
    prisma.trip.findUnique({ where: { id: tripId }, select: { capacity: true } }),
    prisma.tripParticipant.count({ where: { tripId } })
  ]);

  if (trip && taken > trip.capacity) {
    logger.warn('Paid booking has put a trip over capacity', {
      tripId,
      capacity: trip.capacity,
      participants: taken
    });
  }
}
