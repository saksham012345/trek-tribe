import { prisma } from '../lib/prisma';
import { vendorNotificationQueue } from '../lib/queue';

export async function processUnprocessedVendorEvents() {
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
