import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import {
  joinTrip,
  leaveTrip,
  isParticipant,
  participantCount,
  addPaidParticipant,
  TripFullError
} from '../services/tripParticipationService';
import { toNumber } from '../lib/money';

describe('Wave 8 core on Postgres', () => {
  const organizerId = new mongoose.Types.ObjectId().toString();
  const travelerId = new mongoose.Types.ObjectId().toString();

  const cleanup = async () => {
    await prisma.review.deleteMany({ where: { reviewerId: { in: [travelerId] } } });
    await prisma.trip.deleteMany({ where: { organizerId } });
    await prisma.customTripRequest.deleteMany({ where: { travelerId } });
    await prisma.verificationRequest.deleteMany({ where: { organizerId } });
  };

  beforeEach(cleanup);
  afterAll(cleanup);

  const makeTrip = (over: any = {}) =>
    prisma.trip.create({
      data: {
        organizerId,
        title: 'Himalayan Base Camp',
        description: 'A long walk uphill.',
        destination: 'Manali',
        capacity: 10,
        price: 15000,
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
        safetyDisclaimer: 'Walk carefully.',
        ...over
      }
    });

  // ─── trips ──────────────────────────────────────────────────────────────────

  it('refuses a trip that ends before it starts', async () => {
    await expect(
      makeTrip({
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-01')
      })
    ).rejects.toBeDefined();
  });

  it('refuses a capacity of zero', async () => {
    await expect(makeTrip({ capacity: 0 })).rejects.toBeDefined();
  });

  it('refuses a longitude without a latitude', async () => {
    // The GeoJSON array this replaces could hold one number, three numbers, or
    // two numbers in the wrong order.
    await expect(makeTrip({ longitude: 77.1 })).rejects.toBeDefined();
  });

  it('refuses coordinates outside the world', async () => {
    await expect(makeTrip({ longitude: 300, latitude: 12 })).rejects.toBeDefined();
  });

  it('accepts a real coordinate pair', async () => {
    const trip = await makeTrip({ longitude: 77.1887, latitude: 32.2432 });
    expect(trip.longitude).toBeCloseTo(77.1887);
  });

  it('refuses an advance larger than the trip price', async () => {
    await expect(
      makeTrip({ price: 15000, paymentType: 'advance', advanceAmount: 20000 })
    ).rejects.toBeDefined();
  });

  // ─── participants: the three `includes` bugs ────────────────────────────────

  it('tells a participant that they are one', async () => {
    const trip = await makeTrip();
    await joinTrip(trip.id, travelerId);

    // `trip.participants.includes(userId)` compared ObjectIds to a string and
    // was false here, which is why cancelling and viewing a booking both failed
    // for everyone who had one.
    expect(await isParticipant(trip.id, travelerId)).toBe(true);
    expect(await isParticipant(trip.id, organizerId)).toBe(false);
  });

  it('adds a paid participant once however many times the payment is verified', async () => {
    const trip = await makeTrip();

    await addPaidParticipant(trip.id, travelerId);
    await addPaidParticipant(trip.id, travelerId);
    await addPaidParticipant(trip.id, travelerId);

    // Every verification used to append another copy, because the guard against
    // it never fired. Three verifications meant three of the same person, and
    // capacity was measured against that list.
    expect(await participantCount(trip.id)).toBe(1);
  });

  it('refuses a second seat for the same person', async () => {
    const trip = await makeTrip();
    await joinTrip(trip.id, travelerId);
    const second = await joinTrip(trip.id, travelerId);

    expect(second.alreadyJoined).toBe(true);
    expect(await participantCount(trip.id)).toBe(1);
  });

  it('lets someone leave and rejoin', async () => {
    const trip = await makeTrip();
    await joinTrip(trip.id, travelerId);

    expect(await leaveTrip(trip.id, travelerId)).toBe(true);
    expect(await isParticipant(trip.id, travelerId)).toBe(false);

    await joinTrip(trip.id, travelerId);
    expect(await participantCount(trip.id)).toBe(1);
  });

  // ─── capacity is enforced, not merely compared ──────────────────────────────

  it('refuses the eleventh booking on a ten-seat trip', async () => {
    const trip = await makeTrip({ capacity: 2 });

    await joinTrip(trip.id, new mongoose.Types.ObjectId().toString());
    await joinTrip(trip.id, new mongoose.Types.ObjectId().toString());

    await expect(
      joinTrip(trip.id, new mongoose.Types.ObjectId().toString())
    ).rejects.toThrow(TripFullError);
  });

  it('does not sell the last seat twice', async () => {
    const trip = await makeTrip({ capacity: 1 });

    const a = new mongoose.Types.ObjectId().toString();
    const b = new mongoose.Types.ObjectId().toString();

    // Both read the same participant count in the Mongoose version, both found
    // a seat free, and both were added.
    const results = await Promise.allSettled([
      joinTrip(trip.id, a),
      joinTrip(trip.id, b)
    ]);

    const joined = results.filter(r => r.status === 'fulfilled');
    const refused = results.filter(
      r => r.status === 'rejected' && (r as PromiseRejectedResult).reason instanceof TripFullError
    );

    expect(joined).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(await participantCount(trip.id)).toBe(1);
  });

  it('takes its participants with it when a trip is deleted', async () => {
    const trip = await makeTrip();
    await joinTrip(trip.id, travelerId);

    await prisma.trip.delete({ where: { id: trip.id } });

    expect(await prisma.tripParticipant.count({ where: { tripId: trip.id } })).toBe(0);
  });

  // ─── ratings are maintained by the database ─────────────────────────────────

  it('updates a trip rating when a review is written', async () => {
    const trip = await makeTrip();

    await prisma.review.create({
      data: { reviewerId: travelerId, targetId: trip.id, reviewType: 'trip', rating: 5, title: 'Great', comment: 'Loved it' }
    });

    const after = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(toNumber(after!.averageRating)).toBe(5);
    expect(after!.reviewCount).toBe(1);
  });

  it('averages several reviews and follows a deletion back down', async () => {
    const trip = await makeTrip();
    const other = new mongoose.Types.ObjectId().toString();

    const five = await prisma.review.create({
      data: { reviewerId: travelerId, targetId: trip.id, reviewType: 'trip', rating: 5, title: 'A', comment: 'x' }
    });
    await prisma.review.create({
      data: { reviewerId: other, targetId: trip.id, reviewType: 'trip', rating: 3, title: 'B', comment: 'y' }
    });

    let after = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(toNumber(after!.averageRating)).toBe(4);
    expect(after!.reviewCount).toBe(2);

    await prisma.review.delete({ where: { id: five.id } });

    // Nothing in the application touched the trip. The trigger did.
    after = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(toNumber(after!.averageRating)).toBe(3);
    expect(after!.reviewCount).toBe(1);

    await prisma.review.deleteMany({ where: { targetId: trip.id } });
  });

  it('follows a rating that is edited rather than added', async () => {
    const trip = await makeTrip();
    const review = await prisma.review.create({
      data: { reviewerId: travelerId, targetId: trip.id, reviewType: 'trip', rating: 2, title: 'A', comment: 'x' }
    });

    await prisma.review.update({ where: { id: review.id }, data: { rating: 4 } });

    const after = await prisma.trip.findUnique({ where: { id: trip.id } });
    expect(toNumber(after!.averageRating)).toBe(4);
  });

  // ─── trip children ──────────────────────────────────────────────────────────

  it('allows one schedule entry per day and refuses a second', async () => {
    const trip = await makeTrip();
    await prisma.tripScheduleDay.create({
      data: { tripId: trip.id, day: 1, title: 'Arrive', activities: ['Rest'] }
    });

    await expect(
      prisma.tripScheduleDay.create({
        data: { tripId: trip.id, day: 1, title: 'Also arrive', activities: [] }
      })
    ).rejects.toBeDefined();
  });

  it('keeps package keys unique within a trip but not across trips', async () => {
    const one = await makeTrip();
    const two = await makeTrip({ title: 'Another' });

    await prisma.tripPackage.create({
      data: { tripId: one.id, packageKey: 'standard', name: 'Standard', price: 100, capacity: 5 }
    });
    // The same key on a different trip is fine - it was only unique by
    // convention before, and bookings reference it by that key.
    await prisma.tripPackage.create({
      data: { tripId: two.id, packageKey: 'standard', name: 'Standard', price: 100, capacity: 5 }
    });

    await expect(
      prisma.tripPackage.create({
        data: { tripId: one.id, packageKey: 'standard', name: 'Duplicate', price: 200, capacity: 5 }
      })
    ).rejects.toBeDefined();
  });

  it('allows at most one thumbnail photo per trip', async () => {
    const trip = await makeTrip();
    await prisma.tripLivePhoto.create({
      data: { tripId: trip.id, url: 'a.jpg', filename: 'a.jpg', isThumbnail: true }
    });
    await prisma.tripLivePhoto.create({
      data: { tripId: trip.id, url: 'b.jpg', filename: 'b.jpg', isThumbnail: false }
    });

    await expect(
      prisma.tripLivePhoto.create({
        data: { tripId: trip.id, url: 'c.jpg', filename: 'c.jpg', isThumbnail: true }
      })
    ).rejects.toBeDefined();
  });

  it('finds a trip by words in its description', async () => {
    await makeTrip({ title: 'Spiti Valley Expedition', description: 'High altitude cold desert.' });

    const found = await prisma.$queryRaw<Array<{ title: string }>>`
      SELECT title FROM trips
       WHERE to_tsvector(
               'english'::regconfig,
               coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(destination,'')
             ) @@ plainto_tsquery('english', 'cold desert')
    `;
    expect(found.map(f => f.title)).toContain('Spiti Valley Expedition');
  });

  // ─── group bookings ─────────────────────────────────────────────────────────

  const makeBooking = (tripId: string, over: any = {}) =>
    prisma.groupBooking.create({
      data: {
        tripId,
        mainBookerId: travelerId,
        numberOfGuests: 2,
        pricePerPerson: 1000,
        totalAmount: 2000,
        groupDiscount: 0,
        discountAmount: 0,
        finalAmount: 2000,
        paymentMethod: 'razorpay',
        ...over
      }
    });

  it('refuses a booking whose total is not the price times the guests', async () => {
    const trip = await makeTrip();
    await expect(makeBooking(trip.id, { totalAmount: 9999 })).rejects.toBeDefined();
  });

  it('refuses a booking whose final amount ignores its discount', async () => {
    const trip = await makeTrip();
    await expect(
      makeBooking(trip.id, { groupDiscount: 10, discountAmount: 200, finalAmount: 2000 })
    ).rejects.toBeDefined();
  });

  it('accepts a booking whose discount arithmetic is right', async () => {
    const trip = await makeTrip();
    const booking = await makeBooking(trip.id, {
      groupDiscount: 10,
      discountAmount: 200,
      finalAmount: 1800
    });
    expect(toNumber(booking.finalAmount)).toBe(1800);
  });

  it('refuses a refund larger than what was paid', async () => {
    const trip = await makeTrip();
    const booking = await makeBooking(trip.id, { paidAmount: 500 });

    await expect(
      prisma.groupBooking.update({
        where: { id: booking.id },
        data: { refundAmount: 900 }
      })
    ).rejects.toBeDefined();
  });

  it('refuses a second booking of the same trip by the same person', async () => {
    const trip = await makeTrip();
    await makeBooking(trip.id);
    await expect(makeBooking(trip.id)).rejects.toBeDefined();
  });

  it('refuses more than twenty guests', async () => {
    const trip = await makeTrip();
    await expect(
      makeBooking(trip.id, { numberOfGuests: 21, totalAmount: 21000 })
    ).rejects.toBeDefined();
  });

  it('allows only one main booker on a booking', async () => {
    const trip = await makeTrip();
    const booking = await makeBooking(trip.id);

    const participant = (email: string, isMainBooker: boolean) => ({
      bookingId: booking.id,
      name: email,
      email,
      phone: '9999999999',
      emergencyContactName: 'X',
      emergencyContactPhone: '8888888888',
      experienceLevel: 'beginner' as const,
      isMainBooker
    });

    await prisma.bookingParticipant.create({ data: participant('a@b.com', true) });
    await prisma.bookingParticipant.create({ data: participant('c@d.com', false) });

    // transferMainBooker cleared one flag and set another as two separate
    // writes, so a failure between them left two, or none.
    await expect(
      prisma.bookingParticipant.create({ data: participant('e@f.com', true) })
    ).rejects.toBeDefined();
  });

  it('refuses the same email twice in one booking', async () => {
    const trip = await makeTrip();
    const booking = await makeBooking(trip.id);

    const dup = {
      bookingId: booking.id,
      name: 'A',
      email: 'same@b.com',
      phone: '9999999999',
      emergencyContactName: 'X',
      emergencyContactPhone: '8888888888',
      experienceLevel: 'beginner' as const
    };

    await prisma.bookingParticipant.create({ data: dup });
    await expect(prisma.bookingParticipant.create({ data: dup })).rejects.toBeDefined();
  });

  // ─── custom trip requests ───────────────────────────────────────────────────

  const makeRequest = (over: any = {}) =>
    prisma.customTripRequest.create({
      data: { travelerId, destination: 'Ladakh', ...over }
    });

  it('keeps the age group labels with their hyphens', async () => {
    const request = await makeRequest({ ageGroup: 'age_25_40' });

    const raw = await prisma.$queryRaw<Array<{ age_group: string }>>`
      SELECT age_group::text FROM custom_trip_requests WHERE id = ${request.id}
    `;
    // Prisma members cannot start with a digit or contain a hyphen; what Mongo
    // holds is '25-40', so a backfill needs no translation.
    expect(raw[0].age_group).toBe('25-40');
  });

  it('allows one proposal per organizer per request', async () => {
    const request = await makeRequest();

    const proposal = (over: any = {}) => ({
      requestId: request.id,
      organizerId,
      price: 50000,
      itinerarySummary: 'Seven days',
      valueStatement: 'Good value',
      cancellationPolicy: 'Full refund up to 7 days',
      ...over
    });

    await prisma.customTripProposal.create({ data: proposal() });
    await expect(
      prisma.customTripProposal.create({ data: proposal({ price: 40000 }) })
    ).rejects.toBeDefined();
  });

  it('allows only one accepted proposal per request', async () => {
    const request = await makeRequest();
    const other = new mongoose.Types.ObjectId().toString();

    const base = {
      requestId: request.id,
      price: 50000,
      itinerarySummary: 'Seven days',
      valueStatement: 'Good value',
      cancellationPolicy: 'Full refund up to 7 days'
    };

    await prisma.customTripProposal.create({
      data: { ...base, organizerId, status: 'accepted' }
    });

    await expect(
      prisma.customTripProposal.create({
        data: { ...base, organizerId: other, status: 'accepted' }
      })
    ).rejects.toBeDefined();

    // A second pending proposal is still fine.
    await expect(
      prisma.customTripProposal.create({ data: { ...base, organizerId: other } })
    ).resolves.toBeDefined();
  });

  it('caps a value statement at five hundred characters', async () => {
    const request = await makeRequest();
    await expect(
      prisma.customTripProposal.create({
        data: {
          requestId: request.id,
          organizerId,
          price: 1000,
          itinerarySummary: 'x',
          valueStatement: 'x'.repeat(501),
          cancellationPolicy: 'x'
        }
      })
    ).rejects.toBeDefined();
  });

  // ─── verification ───────────────────────────────────────────────────────────

  it('allows one verification per trip', async () => {
    const trip = await makeTrip();
    await prisma.tripVerification.create({ data: { tripId: trip.id, organizerId } });
    await expect(
      prisma.tripVerification.create({ data: { tripId: trip.id, organizerId } })
    ).rejects.toBeDefined();

    await prisma.tripVerification.deleteMany({ where: { tripId: trip.id } });
  });

  it('refuses a trust score above one hundred', async () => {
    await expect(
      prisma.verificationRequest.create({
        data: {
          organizerId,
          organizerName: 'A',
          organizerEmail: 'a@b.com',
          initialTrustScore: 150
        }
      })
    ).rejects.toBeDefined();
  });
});
