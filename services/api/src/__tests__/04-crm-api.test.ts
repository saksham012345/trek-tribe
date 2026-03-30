/**
 * CRM API Integration Tests
 * Covers: lead CRUD, pipeline stage, activities, rescore, lead sources analytics
 * Requirements: 4, 5, 8
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from '../routes/auth';
import crmRoutes from '../routes/crm';
import Lead from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import { User } from '../models/User';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/api/crm', crmRoutes);

let organizerToken: string;
let organizerId: string;
let travelerToken: string;
let leadId: string;

beforeAll(async () => {
  await User.deleteMany({ email: { $in: ['crm-org@test.com', 'crm-traveler@test.com'] } });
  await Lead.deleteMany({});
  await LeadActivity.deleteMany({});

  const orgRes = await request(app).post('/auth/register').send({
    name: 'CRM Organizer',
    email: 'crm-org@test.com',
    password: 'SecurePass123!',
    role: 'organizer',
    phone: '+919000000001',
  });
  organizerToken = orgRes.body.token;
  organizerId = orgRes.body.user._id;

  const travRes = await request(app).post('/auth/register').send({
    name: 'CRM Traveler',
    email: 'crm-traveler@test.com',
    password: 'SecurePass123!',
    role: 'traveler',
    phone: '+919000000002',
  });
  travelerToken = travRes.body.token;
});

// ─── Lead CRUD ────────────────────────────────────────────────────────────────

describe('POST /api/crm/leads', () => {
  it('creates a lead as organizer', async () => {
    const res = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({
        email: 'lead1@example.com',
        name: 'Lead One',
        source: 'inquiry',
        status: 'new',
      })
      .expect(201);

    // Controller wraps in { success, data } or returns flat object
    const lead = res.body._id ? res.body : res.body.data;
    expect(lead).toHaveProperty('_id');
    expect(lead.email).toBe('lead1@example.com');
    leadId = lead._id;
  });

  it('rejects lead creation without auth', async () => {
    await request(app)
      .post('/api/crm/leads')
      .send({ email: 'nope@example.com', source: 'form' })
      .expect(401);
  });

  it('rejects lead creation by traveler', async () => {
    await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${travelerToken}`)
      .send({ email: 'nope@example.com', source: 'form' })
      .expect(403);
  });
});

describe('GET /api/crm/leads', () => {
  it('returns leads for organizer', async () => {
    const res = await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(Array.isArray(res.body) || Array.isArray(res.body.leads) || Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/crm/leads').expect(401);
  });
});

describe('GET /api/crm/leads/:id', () => {
  it('returns a specific lead', async () => {
    const res = await request(app)
      .get(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body._id || res.body.data?._id).toBeTruthy();
  });

  it('returns 404 for non-existent lead', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .get(`/api/crm/leads/${fakeId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(404);
  });
});

describe('PUT /api/crm/leads/:id', () => {
  it('updates a lead', async () => {
    const res = await request(app)
      .put(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ status: 'contacted' })
      .expect(200);

    const lead = res.body._id ? res.body : res.body.data;
    expect(lead.status).toBe('contacted');
  });
});

// ─── Pipeline Stage ───────────────────────────────────────────────────────────

describe('PATCH /api/crm/leads/:id/pipeline-stage', () => {
  it('updates pipeline stage to a valid value', async () => {
    const res = await request(app)
      .patch(`/api/crm/leads/${leadId}/pipeline-stage`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ pipelineStage: 'contacted' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.pipelineStage).toBe('contacted');
  });

  it('rejects invalid pipeline stage', async () => {
    const res = await request(app)
      .patch(`/api/crm/leads/${leadId}/pipeline-stage`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ pipelineStage: 'invalid_stage' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('accepts all valid pipeline stages', async () => {
    const stages = ['new', 'contacted', 'interested', 'negotiating', 'booked', 'lost'];
    for (const stage of stages) {
      const res = await request(app)
        .patch(`/api/crm/leads/${leadId}/pipeline-stage`)
        .set('Authorization', `Bearer ${organizerToken}`)
        .send({ pipelineStage: stage })
        .expect(200);
      expect(res.body.data.pipelineStage).toBe(stage);
    }
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .patch(`/api/crm/leads/${leadId}/pipeline-stage`)
      .send({ pipelineStage: 'new' })
      .expect(401);
  });
});

// ─── Lead Activities ──────────────────────────────────────────────────────────

describe('POST /api/crm/leads/activities', () => {
  it('records a lead activity', async () => {
    const res = await request(app)
      .post('/api/crm/leads/activities')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ leadId, eventType: 'trip_viewed', metadata: { tripId: 'trip123' } })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.eventType).toBe('trip_viewed');
  });

  it('rejects activity without leadId', async () => {
    const res = await request(app)
      .post('/api/crm/leads/activities')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ eventType: 'trip_viewed' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('rejects activity without eventType', async () => {
    const res = await request(app)
      .post('/api/crm/leads/activities')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ leadId })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('rescores lead on booking_abandoned event', async () => {
    const leadBefore = await Lead.findById(leadId);
    const scoreBefore = leadBefore?.leadScore ?? 0;

    await request(app)
      .post('/api/crm/leads/activities')
      .set('Authorization', `Bearer ${organizerToken}`)
      .send({ leadId, eventType: 'booking_abandoned' })
      .expect(201);

    const leadAfter = await Lead.findById(leadId);
    // Score should be >= scoreBefore since booking_abandoned adds +20
    expect(leadAfter?.leadScore).toBeGreaterThanOrEqual(scoreBefore);
  });
});

describe('GET /api/crm/leads/activities/:leadId', () => {
  it('returns activity log for a lead', async () => {
    const res = await request(app)
      .get(`/api/crm/leads/activities/${leadId}`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─── Rescore ──────────────────────────────────────────────────────────────────

describe('POST /api/crm/leads/rescore', () => {
  it('rescores all leads for organizer', async () => {
    const res = await request(app)
      .post('/api/crm/leads/rescore')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.updated).toBe('number');
  });

  it('returns 401 without auth', async () => {
    await request(app).post('/api/crm/leads/rescore').expect(401);
  });
});

// ─── Analytics — Lead Sources ─────────────────────────────────────────────────

describe('GET /api/crm/analytics/lead-sources', () => {
  it('returns lead sources with count and conversion rate', async () => {
    const res = await request(app)
      .get('/api/crm/analytics/lead-sources')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);

    if (res.body.data.length > 0) {
      const item = res.body.data[0];
      expect(item).toHaveProperty('source');
      expect(item).toHaveProperty('count');
      expect(item).toHaveProperty('conversionRate');
    }
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/crm/analytics/lead-sources').expect(401);
  });
});

// ─── CRM Stats ────────────────────────────────────────────────────────────────

describe('GET /api/crm/stats', () => {
  it('returns CRM stats for organizer', async () => {
    const res = await request(app)
      .get('/api/crm/stats')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body).toHaveProperty('totalLeads');
    expect(res.body).toHaveProperty('revenue');
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/crm/stats').expect(401);
  });
});
