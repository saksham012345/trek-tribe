import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../lib/prisma';

function organizerToken(id: string) {
  return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET as string);
}

describe('Vendor communication log', () => {
  const organizerId = 'organizer-comms-test';
  const token = organizerToken(organizerId);
  let vendorId: string;
  let logId: string;

  beforeAll(async () => {
    const vendor = await prisma.vendor.create({
      data: { organizerId, businessName: 'Comms Vendor', category: 'transport', email: 'v@example.com' }
    });
    vendorId = vendor.id;
    const log = await prisma.vendorCommunicationLog.create({
      data: {
        vendorId,
        eventType: 'vendor_payment_completed',
        status: 'sent',
        sentAt: new Date(),
        emailSnapshot: '<p>Original email</p>'
      }
    });
    logId = log.id;
  });

  afterAll(async () => {
    await prisma.vendorCommunicationLog.deleteMany({ where: { vendorId } });
    await prisma.vendor.delete({ where: { id: vendorId } });
  });

  it('lists communication log entries for a trip\'s vendors', async () => {
    // Note: this endpoint filters by vendor's organizerId, since log entries aren't
    // directly trip-scoped in the schema (only via assignmentId, which is nullable
    // for reminder events tied to a trip but not a specific assignment).
    const res = await request(app).get('/api/vendor-communications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.some((l: any) => l.id === logId)).toBe(true);
  });

  it('resends a communication using the stored email snapshot', async () => {
    const res = await request(app).post(`/api/vendor-communications/${logId}/resend`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
  });
});
