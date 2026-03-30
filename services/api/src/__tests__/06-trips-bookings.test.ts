/**
 * Trips & Bookings Integration Tests
 * Covers: trip CRUD, booking creation, access control, validation
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from '../routes/auth';
import tripRoutes from '../routes/trips';
import bookingRoutes from '../routes/bookings';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { GroupBooking } from '../models/GroupBooking';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/trips', tripRoutes);
app.use('/api/group-bookings', bookingRoutes);

let travelerToken: string;
let organizerToken: string;
let organizerId: string;
let travelerId: string;
let tripId: string;
let bookingId: string;

const futureStart = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const futureEnd = new Date(Date.now() + 37 * 24 * 60 * 60 * 1000);

beforeAll(async () => {
  await User.deleteMany({ email: { $in: ['trip-org@test.com', 'trip-traveler@test.com'] } });

  const orgRes = await request(app).post('/auth/register').send({
    name: 'Trip Organizer',
    email: 'trip-org@test.com',
    password: 'SecurePass123!',
    role: 'organizer',
    phone: '+919100000001',
  });
  organizerToken = orgRes.body.token;
  organizerId = orgRes.body.user._id;

  const travRes = await request(app).post('/auth/register').send({
    name: 'Trip Traveler',
    email: 'trip-traveler@test.com',
    password: 'SecurePass123!',
    role: 'traveler',
    phone: '+919100000002',
  });
  travelerToken = travRes.body.token;
  travelerId = travRes.body.user._id;
});

// ─── Trip Creation ────────────────────────────────────────────────────────────

describe('POST /trips', () => {
  it('creates a trip as organizer', async () => {
    const res = await request(app)
      .post('/trips')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        title: 'Himalayan Trek',
        description: 'Amazing trek',
        destination: 'Manali',
        startDate: futureStart,
        endDate: futureEnd,
        price: 15000,
        capacity: 20,
        difficulty: 'moderate',
        category: 'trekking',
        itinerary: [{ day: 1, title: 'Arrival', description: 'Arrive at base' }],
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.title).toBe('Himalayan Trek');
    tripId = res.body._id;
  });

  it('rejects trip creation by traveler', async () => {
    await request(app)
      .post('/trips')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ title: 'Fake Trip', destination: 'Nowhere' })
      .expect(403);
  });

  it('rejects trip with missing required fields', async () => {
    await request(app)
      .post('/trips')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ title: 'Incomplete' })
      .expect(400);
  });

  it('rejects trip without auth', async () => {
    await request(app)
      .post('/trips')
      .send({ title: 'No Auth Trip' })
      .expect(401);
  });
});

// ─── Trip Listing ─────────────────────────────────────────────────────────────

describe('GET /trips', () => {
  it('lists trips publicly', async () => {
    const res = await request(app).get('/trips?status=all').expect(200);
    // API may return array or { trips: [], total: N }
    const trips = Array.isArray(res.body) ? res.body : (res.body.trips || res.body.data || []);
    expect(Array.isArray(trips)).toBe(true);
  });

  it('filters by category', async () => {
    const res = await request(app).get('/trips?status=all&category=trekking').expect(200);
    const trips = Array.isArray(res.body) ? res.body : (res.body.trips || res.body.data || []);
    expect(Array.isArray(trips)).toBe(true);
    trips.forEach((t: any) => expect(t.category).toBe('trekking'));
  });

  it('filters by price range', async () => {
    const res = await request(app).get('/trips?status=all&minPrice=10000&maxPrice=20000').expect(200);
    const trips = Array.isArray(res.body) ? res.body : (res.body.trips || res.body.data || []);
    trips.forEach((t: any) => {
      expect(t.price).toBeGreaterThanOrEqual(10000);
      expect(t.price).toBeLessThanOrEqual(20000);
    });
  });
});

// ─── Trip Detail ──────────────────────────────────────────────────────────────

describe('GET /trips/:id', () => {
  it('returns trip details', async () => {
    const res = await request(app).get(`/trips/${tripId}`).expect(200);
    expect(res.body._id).toBe(tripId);
  });

  it('returns 404 for non-existent trip', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app).get(`/trips/${fakeId}`).expect(404);
  });

  it('returns 400 for malformed ID', async () => {
    await request(app).get('/trips/not-a-valid-id').expect(400);
  });
});

// ─── Trip Update ──────────────────────────────────────────────────────────────

describe('PUT /trips/:id', () => {
  it('updates trip as owner organizer', async () => {
    const res = await request(app)
      .put(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ price: 16000, status: 'active' })
      .expect(200);

    expect(res.body.price).toBe(16000);
    expect(res.body.status).toBe('active');
  });

  it('rejects update by non-owner traveler', async () => {
    await request(app)
      .put(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ price: 1000 })
      .expect(403);
  });
});

// ─── Booking Creation ─────────────────────────────────────────────────────────

describe('POST /api/group-bookings', () => {
  it('creates a booking as traveler', async () => {
    const res = await request(app)
      .post('/api/group-bookings')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({
        tripId,
        numberOfGuests: 2,
        participants: [
          { name: 'Traveler One', email: 'trip-traveler@test.com', phone: '+919100000002', age: 28, gender: 'male' },
          { name: 'Guest Two', email: 'guest2@test.com', phone: '+919100000003', age: 25, gender: 'female' },
        ],
        paymentMethod: 'online',
      })
      .expect(201);

    expect(res.body).toHaveProperty('_id');
    expect(res.body.numberOfGuests).toBe(2);
    expect(res.body.bookingStatus).toBe('pending');
    bookingId = res.body._id;
  });

  it('rejects booking without auth', async () => {
    await request(app)
      .post('/api/group-bookings')
      .send({ tripId, numberOfGuests: 1 })
      .expect(401);
  });

  it('rejects booking for non-existent trip', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .post('/api/group-bookings')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ tripId: fakeId, numberOfGuests: 1 })
      .expect(404);
  });

  it('rejects booking exceeding capacity', async () => {
    const trip = await Trip.findById(tripId);
    const overCapacity = (trip?.capacity ?? 0) + 100;

    await request(app)
      .post('/api/group-bookings')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ tripId, numberOfGuests: overCapacity, participants: [] })
      .expect(400);
  });
});

// ─── Booking Listing ──────────────────────────────────────────────────────────

describe('GET /api/group-bookings', () => {
  it('returns bookings for authenticated user', async () => {
    const res = await request(app)
      .get('/api/group-bookings')
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/group-bookings').expect(401);
  });
});

// ─── Booking Detail ───────────────────────────────────────────────────────────

describe('GET /api/group-bookings/:id', () => {
  it('returns booking details for owner', async () => {
    const res = await request(app)
      .get(`/api/group-bookings/${bookingId}`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(200);

    expect(res.body._id).toBe(bookingId);
  });

  it('rejects access by different user', async () => {
    const otherRes = await request(app).post('/auth/register').send({
      name: 'Other User',
      email: `other-${Date.now()}@test.com`,
      password: 'SecurePass123!',
      role: 'traveler',
      phone: '+919200000001',
    });

    await request(app)
      .get(`/api/group-bookings/${bookingId}`)
      .set('Authorization', `Bearer ${otherRes.body.token}`)
      .expect(403);
  });
});

// ─── Booking Cancellation ─────────────────────────────────────────────────────

describe('DELETE /api/group-bookings/:id', () => {
  it('cancels a booking', async () => {
    const res = await request(app)
      .delete(`/api/group-bookings/${bookingId}`)
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(200);

    expect(res.body.bookingStatus).toBe('cancelled');
  });
});
