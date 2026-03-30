/**
 * Database Import API Endpoint Tests
 * Covers: template download, history endpoint, rollback endpoint, status endpoint
 * Requirements: 1, 6
 *
 * Note: The /import and /preview endpoints require CRM subscription checks
 * (CRMSubscription model). These are tested at the service layer in 05-database-import.test.ts.
 * Here we test the endpoints that don't require CRM subscription gating.
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import authRoutes from '../routes/auth';
import databaseImportRoutes from '../routes/databaseImport';
import ImportedDatabase from '../models/ImportedDatabase';
import Lead from '../models/Lead';
import { User } from '../models/User';
import CRMSubscription from '../models/CRMSubscription';

const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/api/database-import', databaseImportRoutes);

let organizerToken: string;
let organizerId: string;

beforeAll(async () => {
  await User.deleteMany({ email: 'import-api-org@test.com' });

  const orgRes = await request(app).post('/auth/register').send({
    name: 'Import API Org',
    email: 'import-api-org@test.com',
    password: 'SecurePass123!',
    role: 'organizer',
    phone: '+919500000001',
  });
  organizerToken = orgRes.body.token;
  organizerId = orgRes.body.user._id;

  // Grant CRM access for this organizer
  await CRMSubscription.deleteMany({ organizerId });
  await CRMSubscription.create({
    organizerId,
    planType: 'crm_bundle',
    status: 'active',
    crmBundle: { hasAccess: true, price: 2100, features: [] },
  });
});

// ─── Template Download ────────────────────────────────────────────────────────

describe('GET /api/database-import/template/download', () => {
  it('returns CSV template with correct headers', async () => {
    const res = await request(app)
      .get('/api/database-import/template/download')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('email');
    expect(res.text).toContain('name');
    expect(res.text).toContain('phone');
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/database-import/template/download').expect(401);
  });
});

// ─── Import History ───────────────────────────────────────────────────────────

describe('GET /api/database-import/history', () => {
  it('returns import history for organizer', async () => {
    const res = await request(app)
      .get('/api/database-import/history')
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 401 without auth', async () => {
    await request(app).get('/api/database-import/history').expect(401);
  });
});

// ─── Import Status ────────────────────────────────────────────────────────────

describe('GET /api/database-import/:importId/status', () => {
  let importRecordId: string;

  beforeAll(async () => {
    const record = await ImportedDatabase.create({
      organizerId,
      fileName: 'status-test.csv',
      fileSize: 512,
      fileType: 'csv',
      status: 'processing',
      fieldMapping: [],
      config: { skipDuplicates: true, updateExisting: false, validateData: true, autoAssignToOrganizer: true, defaultLeadSource: 'form', defaultLeadStatus: 'new' },
      stats: { totalRecords: 10, successfulImports: 0, failedImports: 0, duplicatesSkipped: 0 },
      importErrors: [],
      importedLeadIds: [],
      processedRows: 5,
      totalRows: 10,
      progressPercentage: 50,
    });
    importRecordId = record._id.toString();
  });

  it('returns import status with progress fields', async () => {
    const res = await request(app)
      .get(`/api/database-import/${importRecordId}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('processedRows');
    expect(res.body.data).toHaveProperty('totalRows');
    expect(res.body.data).toHaveProperty('progressPercentage');
    expect(res.body.data.processedRows).toBe(5);
    expect(res.body.data.totalRows).toBe(10);
    expect(res.body.data.progressPercentage).toBe(50);
  });

  it('returns 404 for non-existent import', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    await request(app)
      .get(`/api/database-import/${fakeId}/status`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(404);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .get(`/api/database-import/${importRecordId}/status`)
      .expect(401);
  });
});

// ─── Rollback Endpoint ────────────────────────────────────────────────────────

describe('POST /api/database-import/:importId/rollback', () => {
  let rollbackImportId: string;

  beforeAll(async () => {
    // Create a lead and import record to rollback
    const lead = await Lead.create({
      email: 'rollback-api@example.com',
      source: 'form',
      assignedTo: organizerId,
    });

    const record = await ImportedDatabase.create({
      organizerId,
      fileName: 'rollback-test.csv',
      fileSize: 256,
      fileType: 'csv',
      status: 'completed',
      fieldMapping: [],
      config: { skipDuplicates: true, updateExisting: false, validateData: true, autoAssignToOrganizer: true, defaultLeadSource: 'form', defaultLeadStatus: 'new' },
      stats: { totalRecords: 1, successfulImports: 1, failedImports: 0, duplicatesSkipped: 0 },
      importErrors: [],
      importedLeadIds: [lead._id],
      canRollback: true,
    });
    rollbackImportId = record._id.toString();
  });

  it('rolls back an import successfully', async () => {
    const res = await request(app)
      .post(`/api/database-import/${rollbackImportId}/rollback`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(200);

    expect(res.body.success).toBe(true);

    // Verify lead was deleted
    const lead = await Lead.findOne({ email: 'rollback-api@example.com' });
    expect(lead).toBeNull();

    // Verify canRollback is now false
    const record = await ImportedDatabase.findById(rollbackImportId);
    expect(record?.canRollback).toBe(false);
  });

  it('rejects double rollback', async () => {
    const res = await request(app)
      .post(`/api/database-import/${rollbackImportId}/rollback`)
      .set('Authorization', `Bearer ${organizerToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth', async () => {
    await request(app)
      .post(`/api/database-import/${rollbackImportId}/rollback`)
      .expect(401);
  });
});
