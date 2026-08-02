import { prisma } from '../lib/prisma';
import { vendorNotificationQueue } from '../lib/queue';
import { processUnprocessedVendorEvents } from '../services/vendorEventRelay';

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
});
