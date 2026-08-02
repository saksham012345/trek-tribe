import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../index';
import { prisma } from '../lib/prisma';
import { Trip } from '../models/Trip';

function organizerToken(id: string) {
  return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET as string);
}

describe('Vendor payment tracking', () => {
  const organizerId = new mongoose.Types.ObjectId().toString();
  const token = organizerToken(organizerId);
  let assignmentId: string;

  beforeAll(async () => {
    const trip = await Trip.create({
      title: 'Payment Test Trip',
      description: 'Test trip',
      organizerId,
      destination: 'Ladakh',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      price: 15000,
      capacity: 20,
      categories: ['adventure'],
      images: []
    });
    const vendorRes = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'Mountain Nest Homestay', category: 'homestay' });
    const assignRes = await request(app).post(`/api/trips/${trip._id}/vendors`).set('Authorization', `Bearer ${token}`)
      .send({ vendorId: vendorRes.body.id, category: 'homestay' });
    assignmentId = assignRes.body.id;
  });

  it('records a payment and creates a payment summary with correct outstanding amount', async () => {
    const res = await request(app)
      .post(`/api/trip-vendor-assignments/${assignmentId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ totalAmount: 84000, amount: 50000, note: 'Advance payment' });

    expect(res.status).toBe(201);

    const summary = await prisma.vendorPayment.findUnique({ where: { assignmentId } });
    expect(summary?.paidAmount.toString()).toBe('50000');
    expect(summary?.status).toBe('partial');
  });

  it('marks status as paid once paidAmount reaches totalAmount', async () => {
    await request(app)
      .post(`/api/trip-vendor-assignments/${assignmentId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 34000, note: 'Final settlement' });

    const summary = await prisma.vendorPayment.findUnique({ where: { assignmentId } });
    expect(summary?.paidAmount.toString()).toBe('84000');
    expect(summary?.status).toBe('paid');
  });

  it('rejects a first payment without totalAmount', async () => {
    const vendorRes = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'No Total Vendor', category: 'guide' });
    const trip = await Trip.create({
      title: 'No Total Trip',
      description: 'Test trip',
      organizerId,
      destination: 'Ladakh',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      price: 15000,
      capacity: 20,
      categories: ['adventure'],
      images: []
    });
    const assignRes = await request(app).post(`/api/trips/${trip._id}/vendors`).set('Authorization', `Bearer ${token}`)
      .send({ vendorId: vendorRes.body.id, category: 'guide' });

    const res = await request(app)
      .post(`/api/trip-vendor-assignments/${assignRes.body.id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 5000 });

    expect(res.status).toBe(400);
    await Trip.deleteOne({ _id: trip._id });
  });
});
