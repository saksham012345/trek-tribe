import { prisma } from '../lib/prisma';
import { vendorNotificationQueue } from '../lib/queue';
import { Trip } from '../models/Trip';

async function synthesizePreDepartureReminders() {
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  threeDaysFromNow.setHours(0, 0, 0, 0);
  const threeDaysFromNowEnd = new Date(threeDaysFromNow);
  threeDaysFromNowEnd.setHours(23, 59, 59, 999);

  const departingTrips = await Trip.find({
    startDate: { $gte: threeDaysFromNow, $lte: threeDaysFromNowEnd },
    status: 'active'
  }).select('_id');

  for (const trip of departingTrips) {
    const tripId = trip._id.toString();

    const alreadyExists = await prisma.vendorEvent.findFirst({
      where: { tripId, eventType: 'pre_departure_reminder' }
    });
    if (alreadyExists) continue;

    await prisma.vendorEvent.create({
      data: { tripId, eventType: 'pre_departure_reminder', payload: {} }
    });
  }
}

export async function processUnprocessedVendorEvents() {
  await synthesizePreDepartureReminders();

  const events = await prisma.vendorEvent.findMany({
    where: { processedAt: null },
    orderBy: { createdAt: 'asc' },
    take: 50
  });

  let enqueuedJobCount = 0;

  for (const event of events) {
    const payload = event.payload as any;
    const assignmentId: string | undefined = payload.assignmentId;

    let vendorIds: string[] = [];
    if (payload.vendorId) {
      vendorIds = [payload.vendorId];
    } else if (assignmentId) {
      const assignment = await prisma.tripVendorAssignment.findUnique({ where: { id: assignmentId } });
      if (assignment) vendorIds = [assignment.vendorId];
    } else {
      const assignments = await prisma.tripVendorAssignment.findMany({ where: { tripId: event.tripId } });
      vendorIds = assignments.map(a => a.vendorId);
    }

    for (const vendorId of vendorIds) {
      await vendorNotificationQueue.add(
        'send-vendor-notification',
        { eventId: event.id, vendorId, eventType: event.eventType, payload },
        { jobId: `${event.id}:${vendorId}` }
      );
      enqueuedJobCount++;
    }

    await prisma.vendorEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  }

  return { processedCount: events.length, enqueuedJobCount };
}
