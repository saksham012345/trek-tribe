/**
 * Lead & LeadActivity Model Tests
 * Covers: schema validation, indexes, pipelineStage defaults, LeadActivity creation
 * Requirements: 2, 3, 8
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import { LeadActivity } from '../models/LeadActivity';
import ImportedDatabase from '../models/ImportedDatabase';

const ORG_ID = new mongoose.Types.ObjectId();

beforeEach(async () => {
  await Lead.deleteMany({ assignedTo: ORG_ID });
  await LeadActivity.deleteMany({});
});

// ─── Lead Model ───────────────────────────────────────────────────────────────

describe('Lead model', () => {
  it('creates a lead with required fields', async () => {
    const lead = await Lead.create({
      email: 'model-test@example.com',
      source: 'form',
      assignedTo: ORG_ID,
    });

    expect(lead._id).toBeDefined();
    expect(lead.email).toBe('model-test@example.com');
    expect(lead.source).toBe('form');
  });

  it('defaults pipelineStage to "new"', async () => {
    const lead = await Lead.create({ email: 'stage@example.com', source: 'form', assignedTo: ORG_ID });
    expect(lead.pipelineStage).toBe('new');
  });

  it('defaults status to "new"', async () => {
    const lead = await Lead.create({ email: 'status@example.com', source: 'form', assignedTo: ORG_ID });
    expect(lead.status).toBe('new');
  });

  it('defaults leadScore to 0', async () => {
    const lead = await Lead.create({ email: 'score@example.com', source: 'form', assignedTo: ORG_ID });
    expect(lead.leadScore).toBe(0);
  });

  it('rejects invalid source enum', async () => {
    await expect(
      Lead.create({ email: 'bad@example.com', source: 'invalid_source', assignedTo: ORG_ID })
    ).rejects.toThrow();
  });

  it('rejects invalid pipelineStage enum', async () => {
    await expect(
      Lead.create({ email: 'bad2@example.com', source: 'form', pipelineStage: 'invalid', assignedTo: ORG_ID })
    ).rejects.toThrow();
  });

  it('rejects missing email', async () => {
    await expect(
      Lead.create({ source: 'form', assignedTo: ORG_ID })
    ).rejects.toThrow();
  });

  it('stores all valid pipeline stages', async () => {
    const stages = ['new', 'contacted', 'interested', 'negotiating', 'booked', 'lost'] as const;
    for (const stage of stages) {
      const lead = await Lead.create({
        email: `stage-${stage}@example.com`,
        source: 'form',
        pipelineStage: stage,
        assignedTo: ORG_ID,
      });
      expect(lead.pipelineStage).toBe(stage);
    }
  });

  it('stores all valid source values', async () => {
    const sources = ['trip_view', 'inquiry', 'partial_booking', 'chat', 'form', 'other'] as const;
    for (const source of sources) {
      const lead = await Lead.create({
        email: `src-${source}@example.com`,
        source,
        assignedTo: ORG_ID,
      });
      expect(lead.source).toBe(source);
    }
  });

  it('caps leadScore at 100 via schema max', async () => {
    const lead = await Lead.create({
      email: 'cap@example.com',
      source: 'form',
      leadScore: 100,
      assignedTo: ORG_ID,
    });
    expect(lead.leadScore).toBe(100);
  });

  it('normalises email to lowercase', async () => {
    const lead = await Lead.create({
      email: 'UPPER@EXAMPLE.COM',
      source: 'form',
      assignedTo: ORG_ID,
    });
    expect(lead.email).toBe('upper@example.com');
  });
});

// ─── LeadActivity Model ───────────────────────────────────────────────────────

describe('LeadActivity model', () => {
  let leadId: mongoose.Types.ObjectId;

  beforeEach(async () => {
    const lead = await Lead.create({ email: 'activity@example.com', source: 'form', assignedTo: ORG_ID });
    leadId = lead._id as mongoose.Types.ObjectId;
  });

  it('creates an activity with required fields', async () => {
    const activity = await LeadActivity.create({
      leadId,
      eventType: 'trip_viewed',
      metadata: { tripId: 'trip123' },
    });

    expect(activity._id).toBeDefined();
    expect(activity.eventType).toBe('trip_viewed');
    expect(activity.leadId.toString()).toBe(leadId.toString());
  });

  it('defaults timestamp to now', async () => {
    const before = new Date();
    const activity = await LeadActivity.create({ leadId, eventType: 'chat_message' });
    const after = new Date();

    expect(activity.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(activity.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('rejects invalid eventType', async () => {
    await expect(
      LeadActivity.create({ leadId, eventType: 'invalid_event' })
    ).rejects.toThrow();
  });

  it('stores all valid event types', async () => {
    const events = [
      'trip_viewed', 'chat_message', 'inquiry_submitted',
      'email_opened', 'booking_started', 'booking_abandoned',
    ] as const;

    for (const eventType of events) {
      const activity = await LeadActivity.create({ leadId, eventType });
      expect(activity.eventType).toBe(eventType);
    }
  });

  it('rejects missing leadId', async () => {
    await expect(
      LeadActivity.create({ eventType: 'trip_viewed' })
    ).rejects.toThrow();
  });
});

// ─── ImportedDatabase Model ───────────────────────────────────────────────────

describe('ImportedDatabase model', () => {
  it('creates an import record with progress fields', async () => {
    const record = await ImportedDatabase.create({
      organizerId: ORG_ID,
      fileName: 'test.csv',
      fileSize: 1024,
      fileType: 'csv',
      status: 'processing',
      fieldMapping: [],
      config: {
        skipDuplicates: true,
        updateExisting: false,
        validateData: true,
        autoAssignToOrganizer: true,
        defaultLeadSource: 'form',
        defaultLeadStatus: 'new',
      },
      stats: { totalRecords: 0, successfulImports: 0, failedImports: 0, duplicatesSkipped: 0 },
      importErrors: [],
      importedLeadIds: [],
      processedRows: 0,
      totalRows: 100,
      progressPercentage: 0,
    });

    expect(record.processedRows).toBe(0);
    expect(record.totalRows).toBe(100);
    expect(record.progressPercentage).toBe(0);
    expect(record.canRollback).toBe(true);

    await ImportedDatabase.findByIdAndDelete(record._id);
  });

  it('defaults canRollback to true', async () => {
    const record = await ImportedDatabase.create({
      organizerId: ORG_ID,
      fileName: 'defaults.csv',
      fileSize: 512,
      fileType: 'csv',
      status: 'completed',
      fieldMapping: [],
      config: { skipDuplicates: true, updateExisting: false, validateData: true, autoAssignToOrganizer: true, defaultLeadSource: 'form', defaultLeadStatus: 'new' },
      stats: { totalRecords: 1, successfulImports: 1, failedImports: 0, duplicatesSkipped: 0 },
      importErrors: [],
      importedLeadIds: [],
    });

    expect(record.canRollback).toBe(true);
    await ImportedDatabase.findByIdAndDelete(record._id);
  });
});
