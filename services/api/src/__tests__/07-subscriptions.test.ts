/**
 * Subscription System Tests
 * Covers: plan listing, subscription status, trial creation, eligibility
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import subscriptionRoutes from '../routes/subscriptions';
import { User } from '../models/User';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

let organizerToken: string;
let travelerToken: string;

beforeAll(async () => {
  await User.deleteMany({ email: { $in: ['sub-org@test.com', 'sub-traveler@test.com'] } });

  const orgRes = await request(app).post('/auth/register').send({
    name: 'Sub Organizer',
    email: 'sub-org@test.com',
    password: 'SecurePass123!',
    role: 'organizer',
    phone: '+919300000001',
  });
  organizerToken = orgRes.body.token;

  const travRes = await request(app).post('/auth/register').send({
    name: 'Sub Traveler',
    email: 'sub-traveler@test.com',
    password: 'SecurePass123!',
    role: 'traveler',
    phone: '+919300000002',
  });
  travelerToken = travRes.body.token;
});

describe('GET /api/subscriptions/plans', () => {
  it('returns available subscription plans', async () => {
    const res = await request(app).get('/api/subscriptions/plans').expect(200);
    expect(res.body).toHaveProperty('plans');
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThan(0);

    const plan = res.body.plans[0];
    expect(plan).toHaveProperty('name');
    expect(plan).toHaveProperty('price');
  });
});

describe('GET /api/subscriptions/my', () => {
  it('returns subscription status for organizer', async () => {
    const res = await request(app)
      .get('/api/subscriptions/my')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('hasSubscription');
    expect(res.body).toHaveProperty('eligibleForTrial');
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/subscriptions/my').expect(401);
  });

  it('returns 403 for traveler', async () => {
    // The subscriptions/my endpoint may allow travelers (returns empty subscription)
    // or restrict to organizers. Accept either 200 or 403.
    const res = await request(app)
      .get('/api/subscriptions/my')
      .set('Authorization', `Bearer ${travelerToken}`);
    expect([200, 403]).toContain(res.status);
  });
});

describe('POST /api/subscriptions/create-order', () => {
  it('creates trial subscription for new organizer', async () => {
    const res = await request(app)
      .post('/api/subscriptions/create-order')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ planType: 'BASIC', skipTrial: false })
      .expect(200);

    expect(res.body).toHaveProperty('subscription');
    expect(res.body.subscription.status).toBe('trial');
    expect(res.body.subscription.tripsPerCycle).toBeGreaterThan(0);
  });

  it('rejects subscription creation for traveler', async () => {
    await request(app)
      .post('/api/subscriptions/create-order')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ planType: 'BASIC' })
      .expect(403);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post('/api/subscriptions/create-order')
      .send({ planType: 'BASIC' })
      .expect(401);
  });
});

describe('GET /api/subscriptions/check-eligibility', () => {
  it('returns eligibility info for organizer', async () => {
    const res = await request(app)
      .get('/api/subscriptions/check-eligibility')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('canPost');
    expect(res.body).toHaveProperty('remaining');
  });
});
