/**
 * Database Import Service Tests
 * Covers: field mapping auto-detection, import logic, rollback, history
 * Requirements: 1, 3, 6, 7
 */
import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { databaseImportService } from '../services/databaseImportService';
import Lead from '../models/Lead';
import ImportedDatabase from '../models/ImportedDatabase';

const ORGANIZER_ID = new mongoose.Types.ObjectId().toString();

// Helper to create a mock Multer file
function makeFile(content: string, mimetype = 'text/csv', name = 'test.csv'): Express.Multer.File {
  return {
    buffer: Buffer.from(content),
    mimetype,
    originalname: name,
    size: content.length,
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: name,
    path: '',
    stream: null as any,
  };
}

afterEach(async () => {
  await Lead.deleteMany({ assignedTo: ORGANIZER_ID });
  await ImportedDatabase.deleteMany({ organizerId: ORGANIZER_ID });
});

// ─── Auto-detect field mapping ────────────────────────────────────────────────

describe('autoDetectFieldMapping', () => {
  it('maps "email" column to "email"', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ email: 'test@example.com' });
    expect(mapping.some(m => m.sourceField === 'email' && m.targetField === 'email')).toBe(true);
  });

  it('maps "mobile" to "phone"', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ mobile: '+919876543210' });
    expect(mapping.some(m => m.sourceField === 'mobile' && m.targetField === 'phone')).toBe(true);
  });

  it('maps "full_name" to "name"', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ full_name: 'John Doe' });
    expect(mapping.some(m => m.sourceField === 'full_name' && m.targetField === 'name')).toBe(true);
  });

  it('maps "notes" to "metadata.notes"', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ notes: 'some note' });
    expect(mapping.some(m => m.sourceField === 'notes' && m.targetField === 'metadata.notes')).toBe(true);
  });

  it('maps "tags" to "metadata.tags"', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ tags: 'adventure,trekking' });
    expect(mapping.some(m => m.sourceField === 'tags' && m.targetField === 'metadata.tags')).toBe(true);
  });

  it('ignores unknown columns', () => {
    const mapping = databaseImportService.autoDetectFieldMapping({ unknownColumn: 'value' });
    expect(mapping.length).toBe(0);
  });
});

// ─── CSV Import ───────────────────────────────────────────────────────────────

describe('importDatabase — CSV', () => {
  it('imports valid CSV rows and returns stats', async () => {
    const csv = `email,name,phone,status,source
alice@example.com,Alice,+911111111111,new,form
bob@example.com,Bob,+912222222222,new,inquiry`;

    const file = makeFile(csv);
    const result = await databaseImportService.importDatabase(file, ORGANIZER_ID, undefined, {
      skipDuplicates: true,
      autoAssignToOrganizer: true,
      defaultLeadSource: 'form',
      defaultLeadStatus: 'new',
    });

    expect(result.success).toBe(true);
    expect(result.stats.successfulImports).toBe(2);
    expect(result.stats.failedImports).toBe(0);
    expect(result.stats.totalRecords).toBe(2);
  });

  it('skips rows with missing email', async () => {
    const csv = `email,name
,No Email
valid@example.com,Valid`;

    const file = makeFile(csv);
    const result = await databaseImportService.importDatabase(file, ORGANIZER_ID);

    expect(result.stats.successfulImports).toBe(1);
    expect(result.stats.failedImports).toBe(1);
  });

  it('skips duplicates when skipDuplicates=true', async () => {
    // Use a unique email so afterEach cleanup from other tests doesn't interfere
    const uniqueEmail = `dup-${Date.now()}@example.com`;
    const csv = `email,name\n${uniqueEmail},First`;
    const importConfig = { skipDuplicates: true, autoAssignToOrganizer: true, defaultLeadSource: 'form', defaultLeadStatus: 'new' };

    // First import — creates the lead assigned to ORGANIZER_ID
    await databaseImportService.importDatabase(makeFile(csv), ORGANIZER_ID, undefined, importConfig);
    // Second import — same email + same organizer, should skip
    const result = await databaseImportService.importDatabase(makeFile(csv), ORGANIZER_ID, undefined, importConfig);

    expect(result.stats.duplicatesSkipped).toBe(1);
    expect(result.stats.successfulImports).toBe(0);
  });

  it('updates existing lead when updateExisting=true', async () => {
    const csv = `email,name
update@example.com,Original`;

    const file = makeFile(csv);
    await databaseImportService.importDatabase(file, ORGANIZER_ID, undefined, { skipDuplicates: true });

    const csv2 = `email,name
update@example.com,Updated`;
    const file2 = makeFile(csv2);
    const result = await databaseImportService.importDatabase(file2, ORGANIZER_ID, undefined, {
      skipDuplicates: true,
      updateExisting: true,
    });

    expect(result.stats.successfulImports).toBe(1);
    expect(result.stats.duplicatesSkipped).toBe(0);
  });

  it('assigns leads to organizer', async () => {
    const csv = `email,name
assigned@example.com,Assigned`;

    const file = makeFile(csv);
    await databaseImportService.importDatabase(file, ORGANIZER_ID, undefined, {
      autoAssignToOrganizer: true,
    });

    const lead = await Lead.findOne({ email: 'assigned@example.com' });
    expect(lead?.assignedTo?.toString()).toBe(ORGANIZER_ID);
  });

  it('returns empty array stats for empty CSV', async () => {
    const csv = `email,name\n`;
    const file = makeFile(csv);

    await expect(
      databaseImportService.importDatabase(file, ORGANIZER_ID)
    ).rejects.toThrow();
  });
});

// ─── Import History ───────────────────────────────────────────────────────────

describe('getImportHistory', () => {
  it('returns import records sorted by createdAt desc', async () => {
    const csv = `email\nhist1@example.com`;
    await databaseImportService.importDatabase(makeFile(csv), ORGANIZER_ID);
    await databaseImportService.importDatabase(makeFile(csv.replace('hist1', 'hist2')), ORGANIZER_ID);

    const history = await databaseImportService.getImportHistory(ORGANIZER_ID, 10);
    expect(history.length).toBeGreaterThanOrEqual(2);
    // Verify descending order
    for (let i = 1; i < history.length; i++) {
      expect(new Date(history[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(history[i].createdAt).getTime()
      );
    }
  });

  it('respects limit parameter', async () => {
    const history = await databaseImportService.getImportHistory(ORGANIZER_ID, 1);
    expect(history.length).toBeLessThanOrEqual(1);
  });
});

// ─── Rollback ─────────────────────────────────────────────────────────────────

describe('rollbackImport', () => {
  it('deletes imported leads and marks canRollback=false', async () => {
    const csv = `email\nrollback@example.com`;
    const result = await databaseImportService.importDatabase(makeFile(csv), ORGANIZER_ID);
    const importId = result.importId!;

    // Verify lead exists
    const leadBefore = await Lead.findOne({ email: 'rollback@example.com' });
    expect(leadBefore).not.toBeNull();

    // Rollback
    const success = await databaseImportService.rollbackImport(importId, ORGANIZER_ID);
    expect(success).toBe(true);

    // Lead should be gone
    const leadAfter = await Lead.findOne({ email: 'rollback@example.com' });
    expect(leadAfter).toBeNull();

    // Import record should have canRollback=false
    const record = await ImportedDatabase.findById(importId);
    expect(record?.canRollback).toBe(false);
    expect(record?.rolledBackAt).toBeDefined();
  });

  it('throws when rolling back already-rolled-back import', async () => {
    const csv = `email\ndouble-rollback@example.com`;
    const result = await databaseImportService.importDatabase(makeFile(csv), ORGANIZER_ID);
    const importId = result.importId!;

    await databaseImportService.rollbackImport(importId, ORGANIZER_ID);

    await expect(
      databaseImportService.rollbackImport(importId, ORGANIZER_ID)
    ).rejects.toThrow(/cannot be rolled back|already been rolled back/i);
  });

  it('throws for non-existent import record', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(
      databaseImportService.rollbackImport(fakeId, ORGANIZER_ID)
    ).rejects.toThrow(/not found/i);
  });
});

// ─── getSampleData ────────────────────────────────────────────────────────────

describe('getSampleData', () => {
  it('returns up to N rows from CSV', async () => {
    const csv = `email,name
a@example.com,A
b@example.com,B
c@example.com,C
d@example.com,D
e@example.com,E
f@example.com,F`;

    const file = makeFile(csv);
    const sample = await databaseImportService.getSampleData(file, 3);
    expect(sample.length).toBe(3);
  });

  it('returns all rows when file has fewer than N rows', async () => {
    const csv = `email,name\na@example.com,A`;
    const file = makeFile(csv);
    const sample = await databaseImportService.getSampleData(file, 5);
    expect(sample.length).toBe(1);
  });
});
