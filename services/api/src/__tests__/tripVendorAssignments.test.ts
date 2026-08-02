import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../index';
import { prisma } from '../lib/prisma';
import { Trip } from '../models/Trip';

function organizerToken(id: string) {
  return jwt.sign({ id, role: 'organizer' }, process.env.JWT_SECRET as string);
}

describe('Trip-vendor assignment', () => {
  const organizerId = new mongoose.Types.ObjectId().toString();
  const token = organizerToken(organizerId);
  let tripId: string;
  let vendorId: string;

  beforeAll(async () => {
    const trip = await Trip.create({
      title: 'Spiti Expedition',
      description: 'Test trip',
      organizerId,
      destination: 'Spiti',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      price: 15000,
      capacity: 20,
      categories: ['adventure'],
      images: []
    });
    tripId = trip._id.toString();

    const vendorRes = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'ABC Travels', category: 'transport' });
    vendorId = vendorRes.body.id;
  });

  afterAll(async () => {
    await prisma.tripVendorAssignment.deleteMany({ where: { tripId } });
    await prisma.vendor.deleteMany({ where: { organizerId } });
    await Trip.deleteOne({ _id: tripId });
  });

  it('assigns a vendor to a trip', async () => {
    const res = await request(app)
      .post(`/api/trips/${tripId}/vendors`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vendorId, category: 'transport' });

    expect(res.status).toBe(201);
    expect(res.body.tripId).toBe(tripId);
    expect(res.body.vendorId).toBe(vendorId);
  });

  it('rejects assignment to a trip that does not exist', async () => {
    const fakeTripId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post(`/api/trips/${fakeTripId}/vendors`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vendorId, category: 'transport' });

    expect(res.status).toBe(404);
  });

  it('rejects assignment to a trip owned by a different organizer', async () => {
    const otherTrip = await Trip.create({
      title: 'Other Organizer Trip',
      description: 'Test trip',
      organizerId: new mongoose.Types.ObjectId().toString(),
      destination: 'Manali',
      startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      price: 15000,
      capacity: 20,
      categories: ['adventure'],
      images: []
    });

    const res = await request(app)
      .post(`/api/trips/${otherTrip._id}/vendors`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vendorId, category: 'transport' });

    expect(res.status).toBe(403);
    await Trip.deleteOne({ _id: otherTrip._id });
  });

  it('allows multiple vendors in the same category on one trip', async () => {
    const secondVendorRes = await request(app).post('/api/vendors').set('Authorization', `Bearer ${token}`)
      .send({ businessName: 'XYZ Transport', category: 'transport' });

    const res = await request(app)
      .post(`/api/trips/${tripId}/vendors`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vendorId: secondVendorRes.body.id, category: 'transport' });

    expect(res.status).toBe(201);

    const list = await request(app).get(`/api/trips/${tripId}/vendors`).set('Authorization', `Bearer ${token}`);
    expect(list.body.filter((a: any) => a.category === 'transport').length).toBe(2);
  });
});
