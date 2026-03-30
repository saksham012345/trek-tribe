import Bull, { Queue, Job } from 'bull';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { Readable } from 'stream';
import { z } from 'zod';
import Lead from '../models/Lead';
import ImportedDatabase from '../models/ImportedDatabase';
import { leadScoringService } from '../services/leadScoringService';
import { socketService } from '../services/socketService';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export interface ImportJobData {
  importId: string;
  organizerId: string;
  fileBuffer: string; // base64
  fileName: string;
  mimeType: string;
  fieldMapping: { sourceField: string; targetField: string; transform?: string }[];
  config: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
    validateData?: boolean;
    autoAssignToOrganizer?: boolean;
    defaultLeadSource?: string;
    defaultLeadStatus?: string;
    defaultTags?: string[];
  };
}

const MAX_ROWS = 5000;
const PROGRESS_UPDATE_INTERVAL = 50;

// Zod schema for row validation
const leadRowSchema = z.object({
  email: z.string().email().max(254),
  phone: z.string().regex(/^[+]?[1-9]\d{1,14}$/).optional().or(z.literal('')),
  name: z.string().max(100).optional(),
  status: z.enum(['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost']).optional(),
  source: z.enum(['trip_view', 'inquiry', 'partial_booking', 'chat', 'form', 'other']).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.string().max(500).optional(),
}).passthrough();

// CSV injection protection
function sanitizeCsvField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return `'${value}`;
  return value.trim();
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    sanitized[k] = sanitizeCsvField(v);
  }
  return sanitized;
}

async function parseCSV(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    Readable.from(buffer)
      .pipe(csv())
      .on('data', d => results.push(d))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseExcel(buffer: Buffer): any[] {
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return xlsx.utils.sheet_to_json(ws);
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (last === 'tags' && typeof value === 'string') {
    cur[last] = value.split(',').map((t: string) => t.trim());
  } else {
    cur[last] = value;
  }
}

function mapRowToLead(
  row: any,
  fieldMapping: ImportJobData['fieldMapping'],
  organizerId: string,
  config: ImportJobData['config']
): any {
  const lead: any = {
    assignedTo: organizerId,
    source: config.defaultLeadSource || 'form',
    status: config.defaultLeadStatus || 'new',
    leadScore: 0,
    interactions: [],
    metadata: { tags: config.defaultTags || [], travelerDetails: {} },
  };
  for (const m of fieldMapping) {
    const val = row[m.sourceField];
    if (val === undefined || val === null || val === '') continue;
    setNestedValue(lead, m.targetField, val);
  }
  return lead;
}

// Create the Bull queue
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
export const importQueue: Queue<ImportJobData> = new Bull<ImportJobData>('lead-import', redisUrl, {
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// Process jobs
importQueue.process(async (job: Job<ImportJobData>) => {
  const { importId, organizerId, fileBuffer, fileName, mimeType, fieldMapping, config } = job.data;

  const importRecord = await ImportedDatabase.findById(importId);
  if (!importRecord) throw new Error(`Import record ${importId} not found`);

  try {
    // Decode file
    const buffer = Buffer.from(fileBuffer, 'base64');
    const isExcel = mimeType.includes('sheet') || mimeType.includes('excel') || fileName.endsWith('.xlsx');
    const records: any[] = isExcel ? parseExcel(buffer) : await parseCSV(buffer);

    if (records.length === 0) {
      importRecord.status = 'failed';
      importRecord.stats.totalRecords = 0;
      await importRecord.save();
      return;
    }

    // Row limit check
    if (records.length > MAX_ROWS) {
      importRecord.status = 'failed';
      importRecord.importErrors = [{
        row: 0,
        error: `Import limit exceeded. Maximum ${MAX_ROWS} leads per file.`,
        timestamp: new Date(),
      }];
      await importRecord.save();
      return;
    }

    importRecord.totalRows = records.length;
    importRecord.stats.totalRecords = records.length;
    await importRecord.save();

    const importedLeadIds: mongoose.Types.ObjectId[] = [];
    const errors: any[] = [];
    let successCount = 0;
    let failCount = 0;
    let dupCount = 0;

    for (let i = 0; i < records.length; i++) {
      try {
        const sanitized = sanitizeRow(records[i]);
        const leadData = mapRowToLead(sanitized, fieldMapping, organizerId, config);

        // Validate
        const parsed = leadRowSchema.safeParse({ ...sanitized, ...leadData });
        if (!parsed.success) {
          errors.push({ row: i + 1, error: parsed.error.issues.map(e => e.message).join(', '), timestamp: new Date() });
          failCount++;
          continue;
        }

        if (!leadData.email) {
          errors.push({ row: i + 1, error: 'Email is required', timestamp: new Date() });
          failCount++;
          continue;
        }

        // Dedup
        const existing = await Lead.findOne({ email: leadData.email.toLowerCase(), assignedTo: organizerId });
        if (existing) {
          if (config.updateExisting) {
            await Lead.findByIdAndUpdate(existing._id, { $set: leadData });
            successCount++;
          } else {
            dupCount++;
          }
          continue;
        }

        // Score
        leadData.leadScore = leadScoringService.computeScore(leadData);

        const lead = await Lead.create(leadData);
        importedLeadIds.push(lead._id as mongoose.Types.ObjectId);
        successCount++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message, timestamp: new Date() });
        failCount++;
      }

      // Update progress every N rows
      if ((i + 1) % PROGRESS_UPDATE_INTERVAL === 0 || i === records.length - 1) {
        const pct = Math.round(((i + 1) / records.length) * 100);
        await ImportedDatabase.findByIdAndUpdate(importId, {
          processedRows: i + 1,
          progressPercentage: pct,
        });
      }
    }

    // Final update
    const finalStatus = failCount === 0 ? 'completed' : successCount > 0 ? 'partially_completed' : 'failed';
    importRecord.status = finalStatus;
    importRecord.stats = { totalRecords: records.length, successfulImports: successCount, failedImports: failCount, duplicatesSkipped: dupCount };
    importRecord.importErrors = errors;
    importRecord.importedLeadIds = importedLeadIds;
    importRecord.processedRows = records.length;
    importRecord.progressPercentage = 100;
    await importRecord.save();

    // Emit Socket.IO event
    try {
      socketService.getIO()?.emit(`leads_imported:${organizerId}`, { importId, stats: importRecord.stats });
    } catch (_) { /* socket optional */ }

    logger.info('Import job completed', { importId, organizerId, stats: importRecord.stats });
  } catch (err: any) {
    logger.error('Import job failed', { importId, error: err.message });
    await ImportedDatabase.findByIdAndUpdate(importId, {
      status: 'failed',
      importErrors: [{ row: 0, error: err.message, timestamp: new Date() }],
    });
    throw err;
  }
});

importQueue.on('failed', (job, err) => {
  logger.error('Import queue job failed', { jobId: job.id, error: err.message });
});
