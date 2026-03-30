/**
 * Access Control & Security Tests
 * Covers: JWT auth, role-based access, CRM access gating, rate limiting concepts
 * Requirements: 8 (access control)
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes from '../routes/auth';
import crmRoutes from '../routes/crm';
import tripRoutes from '../routes/trips';
import { User } from '../models/User';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/api/crm', crmRoutes);
app.use('/trips', tripRoutes);

let organizerToken: string;
let travelerToken: string;

beforeAll(async () => {
  await User.deleteMany({ email: { $in: ['ac-org@test.com', 'ac-traveler@test.com'] } });

  const orgRes = await request(app).post('/auth/register').send({
    name: 'AC Organizer',
    email: 'ac-org@test.com',
    password: 'SecurePass123!',
    role: 'organizer',
    phone: '+919400000001',
  });
  organizerToken = orgRes.body.token;

  const travRes = await request(app).post('/auth/register').send({
    name: 'AC Traveler',
    email: 'ac-traveler@test.com',
    password: 'SecurePass123!',
    role: 'traveler',
    phone: '+919400000002',
  });
  travelerToken = travRes.body.token;
});

// ─── Unauthenticated access ───────────────────────────────────────────────────

describe('Unauthenticated access returns 401', () => {
  const protectedRoutes = [
    { method: 'get', path: '/api/crm/leads' },
    { method: 'post', path: '/api/crm/leads' },
    { method: 'get', path: '/api/crm/stats' },
    { method: 'post', path: '/api/crm/leads/rescore' },
    { method: 'get', path: '/api/crm/analytics/lead-sources' },
  ];

  for (const route of protectedRoutes) {
    it(`${route.method.toUpperCase()} ${route.path} → 401`, async () => {
      const res = await (request(app) as any)[route.method](route.path);
      expect(res.status).toBe(401);
    });
  }
});

// ─── Traveler cannot access organizer-only routes ─────────────────────────────

describe('Traveler role cannot access organizer-only CRM routes', () => {
  it('GET /api/crm/leads → 403 for traveler', async () => {
    await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(403);
  });

  it('POST /api/crm/leads → 403 for traveler', async () => {
    await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ email: 'x@x.com', source: 'form' })
      .expect(403);
  });

  it('POST /api/crm/leads/rescore → 403 for traveler', async () => {
    await request(app)
      .post('/api/crm/leads/rescore')
      .set('Authorization', `Bearer ${travelerToken}`)
      .expect(403);
  });
});

// ─── Invalid token ────────────────────────────────────────────────────────────

describe('Invalid/expired token returns 401', () => {
  it('malformed token → 401', async () => {
    await request(app)
      .get('/api/crm/leads')
      .set('Authorization', 'Bearer this.is.not.valid')
      .expect(401);
  });

  it('empty Authorization header → 401', async () => {
    await request(app)
      .get('/api/crm/leads')
      .set('Authorization', '')
      .expect(401);
  });
});

// ─── Organizer can access their own resources ─────────────────────────────────

describe('Organizer can access CRM routes', () => {
  it('GET /api/crm/leads → 200 for organizer', async () => {
    await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);
  });

  it('GET /api/crm/stats → 200 for organizer', async () => {
    await request(app)
      .get('/api/crm/stats')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);
  });
});

// ─── Trip creation role enforcement ──────────────────────────────────────────

describe('Trip creation role enforcement', () => {
  it('traveler cannot create trips → 403', async () => {
    await request(app)
      .post('/trips')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ title: 'Fake', destination: 'Nowhere' })
      .expect(403);
  });

  it('unauthenticated cannot create trips → 401', async () => {
    await request(app)
      .post('/trips')
      .send({ title: 'Fake', destination: 'Nowhere' })
      .expect(401);
  });
});
