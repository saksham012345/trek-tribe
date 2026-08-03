import { prisma } from '../lib/prisma';
import { vendorNotificationQueue } from '../lib/queue';
import { processUnprocessedVendorEvents } from '../services/vendorEventRelay';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';

describe('Vendor event relay', () => {
  let vendorId: string;
  let assignmentId: string;
  const tripId = 'trip-relay-test-1';

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: { organizerId: 'organizer-relay-test', businessName: 'Relay Test Vendor', category: 'transport' }
    });
    vendorId = vendor.id;
    const assignment = await prisma.tripVendorAssignment.create({
      data: { tripId, vendorId, category: 'transport' }
    });
    assignmentId = assignment.id;
  });

  afterAll(async () => {
    await prisma.vendorEvent.deleteMany({ where: { tripId } });
    await prisma.tripVendorAssignment.deleteMany({ where: { tripId } });
    await prisma.vendor.delete({ where: { id: vendorId } });
    await vendorNotificationQueue.obliterate({ force: true });
  });

  it('enqueues one notification job per assigned vendor and marks the event processed', async () => {
    const event = await prisma.vendorEvent.create({
      data: {
        tripId,
        eventType: 'vendor_payment_completed',
        payload: { assignmentId, vendorId, amount: 50000 }
      }
    });

    const result = await processUnprocessedVendorEvents();

    expect(result.processedCount).toBeGreaterThanOrEqual(1);
    expect(result.enqueuedJobCount).toBeGreaterThanOrEqual(1);

    const updated = await prisma.vendorEvent.findUnique({ where: { id: event.id } });
    expect(updated?.processedAt).not.toBeNull();

    const jobs = await vendorNotificationQueue.getJobs(['waiting', 'delayed']);
    expect(jobs.some(j => j.data.eventId === event.id && j.data.vendorId === vendorId)).toBe(true);
  });

  it('does not enqueue duplicate jobs when run twice against the same event (idempotency)', async () => {
    const event = await prisma.vendorEvent.create({
      data: {
        tripId,
        eventType: 'vendor_payment_completed',
        payload: { assignmentId, vendorId, amount: 20000 }
      }
    });

    await processUnprocessedVendorEvents();
    const countsAfterFirst = (await vendorNotificationQueue.getJobs(['waiting', 'delayed']))
      .filter(j => j.data.eventId === event.id).length;

    // Simulate a crash-and-retry: manually reset processedAt to null, then re-run.
    await prisma.vendorEvent.update({ where: { id: event.id }, data: { processedAt: null } });
    await processUnprocessedVendorEvents();
    const countsAfterSecond = (await vendorNotificationQueue.getJobs(['waiting', 'delayed']))
      .filter(j => j.data.eventId === event.id).length;

    expect(countsAfterSecond).toBe(countsAfterFirst);
  });

  it('synthesizes a pre_departure_reminder event for a trip departing in exactly 3 days, once', async () => {
    const departingTripId = new mongoose.Types.ObjectId().toString();
    const threeDaysOut = new Date();
    threeDaysOut.setDate(threeDaysOut.getDate() + 3);

    await Trip.create({
      _id: departingTripId,
      title: 'Reminder Test Trip',
      description: 'Test trip',
      organizerId: 'organizer-reminder-test',
      destination: 'Manali',
      startDate: threeDaysOut,
      endDate: threeDaysOut,
      price: 15000,
      capacity: 20,
      categories: ['adventure'],
      images: [],
      status: 'active'
    });

    const vendor = await prisma.vendor.create({
      data: { organizerId: 'organizer-reminder-test', businessName: 'Reminder Vendor', category: 'guide' }
    });
    await prisma.tripVendorAssignment.create({
      data: { tripId: departingTripId, vendorId: vendor.id, category: 'guide' }
    });

    await processUnprocessedVendorEvents();

    const event = await prisma.vendorEvent.findFirst({
      where: { tripId: departingTripId, eventType: 'pre_departure_reminder' }
    });
    expect(event).not.toBeNull();

    // Run again — must not create a second reminder event for the same trip.
    await processUnprocessedVendorEvents();
    const eventsAfterSecondRun = await prisma.vendorEvent.findMany({
      where: { tripId: departingTripId, eventType: 'pre_departure_reminder' }
    });
    expect(eventsAfterSecondRun.length).toBe(1);

    await prisma.tripVendorAssignment.deleteMany({ where: { tripId: departingTripId } });
    await prisma.vendor.delete({ where: { id: vendor.id } });
    await prisma.vendorEvent.deleteMany({ where: { tripId: departingTripId } });
    await Trip.deleteOne({ _id: departingTripId });
  });
});
