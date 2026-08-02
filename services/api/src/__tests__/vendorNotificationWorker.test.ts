import { renderVendorEmail } from '../services/vendorNotificationTemplates';

describe('Vendor notification templates', () => {
  it('renders a vendor_payment_completed email with the payment amount, no internal fields leaked', () => {
    const { subject, html } = renderVendorEmail('vendor_payment_completed', {
      assignmentId: 'a1',
      amount: 50000,
      vendorBusinessName: 'ABC Travels'
    });

    expect(subject).toContain('Payment');
    expect(html).toContain('50000');
    expect(html).toContain('ABC Travels');
    expect(html).not.toContain('assignmentId'); // internal field name must not leak into vendor-facing copy
  });

  it('renders a pre_departure_reminder email with the trip departure info', () => {
    const { subject, html } = renderVendorEmail('pre_departure_reminder', {
      tripTitle: 'Spiti Expedition',
      startDate: '2026-08-15',
      vendorBusinessName: 'Mountain Nest Homestay'
    });

    expect(subject).toContain('Reminder');
    expect(html).toContain('Spiti Expedition');
    expect(html).toContain('2026-08-15');
  });
});

import { prisma } from '../lib/prisma';
import { processNotificationJob } from '../services/vendorNotificationWorker';
import * as emailServiceModule from '../services/emailService';

describe('Vendor notification worker — send and log', () => {
  let vendorId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: {
        organizerId: 'organizer-worker-test',
        businessName: 'Worker Test Vendor',
        category: 'transport',
        email: 'vendor@example.com'
      }
    });
    vendorId = vendor.id;
  });

  afterAll(async () => {
    await prisma.vendorCommunicationLog.deleteMany({ where: { vendorId } });
    await prisma.vendor.delete({ where: { id: vendorId } });
  });

  it('sends the email and writes a "sent" log entry on success', async () => {
    jest.spyOn(emailServiceModule.emailService, 'sendEmail').mockResolvedValue(true);

    await processNotificationJob({
      eventId: 'evt-1',
      vendorId,
      eventType: 'vendor_payment_completed',
      payload: { amount: 50000, vendorBusinessName: 'Worker Test Vendor' }
    } as any);

    const log = await prisma.vendorCommunicationLog.findFirst({ where: { vendorId }, orderBy: { createdAt: 'desc' } });
    expect(log?.status).toBe('sent');
    expect(log?.emailSnapshot).toContain('50000');
  });

  it('writes a "failed" log entry when the email send throws', async () => {
    jest.spyOn(emailServiceModule.emailService, 'sendEmail').mockRejectedValue(new Error('SMTP down'));

    await expect(processNotificationJob({
      eventId: 'evt-2',
      vendorId,
      eventType: 'vendor_payment_completed',
      payload: { amount: 1000, vendorBusinessName: 'Worker Test Vendor' }
    } as any)).rejects.toThrow('SMTP down');

    const log = await prisma.vendorCommunicationLog.findFirst({
      where: { vendorId },
      orderBy: { createdAt: 'desc' }
    });
    expect(log?.status).toBe('failed');
  });
});
