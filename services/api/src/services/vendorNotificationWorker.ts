import { Worker, Job } from 'bullmq';
import { getRedisConnection, VENDOR_NOTIFICATION_QUEUE, VENDOR_RELAY_QUEUE } from '../lib/queue';
import { prisma } from '../lib/prisma';
import { emailService } from './emailService';
import { renderVendorEmail } from './vendorNotificationTemplates';
import { processUnprocessedVendorEvents } from './vendorEventRelay';

interface NotificationJobData {
  eventId: string;
  vendorId: string;
  eventType: 'vendor_payment_completed' | 'pre_departure_reminder';
  payload: any;
}

export async function processNotificationJob(data: NotificationJobData) {
  const vendor = await prisma.vendor.findUnique({ where: { id: data.vendorId } });
  if (!vendor || !vendor.email) {
    throw new Error(`Vendor ${data.vendorId} has no email on file`);
  }

  const { subject, html } = renderVendorEmail(data.eventType, {
    ...data.payload,
    vendorBusinessName: vendor.businessName
  });

  let sendSucceeded = false;
  let sendError: Error | undefined;
  try {
    // sendEmail returns `false` on a handled send failure and only throws on
    // an unexpected error (e.g. transport misconfiguration) — both must be
    // treated as failure here, since BullMQ's retry only re-runs the job if
    // this function throws.
    sendSucceeded = await emailService.sendEmail({ to: vendor.email, subject, html });
  } catch (err: any) {
    sendError = err;
  }

  if (sendSucceeded) {
    await prisma.vendorCommunicationLog.create({
      data: {
        assignmentId: data.payload.assignmentId,
        vendorId: data.vendorId,
        eventType: data.eventType,
        status: 'sent',
        sentAt: new Date(),
        emailSnapshot: html
      }
    });
    return;
  }

  await prisma.vendorCommunicationLog.create({
    data: {
      assignmentId: data.payload.assignmentId,
      vendorId: data.vendorId,
      eventType: data.eventType,
      status: 'failed',
      emailSnapshot: html
    }
  });
  throw sendError || new Error('emailService.sendEmail returned false');
}

export function startVendorNotificationWorkers() {
  const connection = getRedisConnection();

  const notificationWorker = new Worker(
    VENDOR_NOTIFICATION_QUEUE,
    async (job: Job) => processNotificationJob(job.data),
    { connection }
  );

  const relayWorker = new Worker(
    VENDOR_RELAY_QUEUE,
    async () => processUnprocessedVendorEvents(),
    { connection }
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`Vendor notification job ${job?.id} failed:`, err.message);
  });

  return { notificationWorker, relayWorker };
}
