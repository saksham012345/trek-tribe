import csv from 'csv-parser';
import xlsx from 'xlsx';
import { Readable } from 'stream';
import { prisma } from '../lib/prisma';

import { logger } from '../utils/logger';
import mongoose from 'mongoose';

interface ImportConfig {
  skipDuplicates?: boolean;
  updateExisting?: boolean;
  validateData?: boolean;
  autoAssignToOrganizer?: boolean;
  defaultLeadSource?: string;
  defaultLeadStatus?: string;
  defaultTags?: string[];
}

interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform?: string;
}

interface ImportResult {
  success: boolean;
  importId?: string;
  stats: {
    totalRecords: number;
    successfulImports: number;
    failedImports: number;
    duplicatesSkipped: number;
  };
  errors?: any[];
}

class DatabaseImportService {
  
  /**
   * Parse CSV file
   */
  private async parseCSV(buffer: Buffer): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const stream = Readable.from(buffer);
      
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Parse Excel file
   */
  private parseExcel(buffer: Buffer): any[] {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(worksheet);
  }

  /**
   * Parse JSON file
   */
  private parseJSON(buffer: Buffer): any[] {
    const data = JSON.parse(buffer.toString());
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Auto-detect field mapping
   */
  autoDetectFieldMapping(sampleRecord: any): FieldMapping[] {
    const mapping: FieldMapping[] = [];
    const fieldMappings: { [key: string]: string } = {
      // Email variations
      'email': 'email',
      'e-mail': 'email',
      'email_address': 'email',
      'emailaddress': 'email',
      'mail': 'email',
      
      // Phone variations
      'phone': 'phone',
      'mobile': 'phone',
      'phone_number': 'phone',
      'phonenumber': 'phone',
      'contact': 'phone',
      'contact_number': 'phone',
      'cell': 'phone',
      'telephone': 'phone',
      
      // Name variations
      'name': 'name',
      'full_name': 'name',
      'fullname': 'name',
      'customer_name': 'name',
      'client_name': 'name',
      'contact_name': 'name',
      
      // Status variations
      'status': 'status',
      'lead_status': 'status',
      'customer_status': 'status',
      
      // Source variations
      'source': 'source',
      'lead_source': 'source',
      'origin': 'source',
      'channel': 'source',
      
      // Notes variations
      'notes': 'metadata.notes',
      'note': 'metadata.notes',
      'comments': 'metadata.notes',
      'description': 'metadata.notes',
      'remarks': 'metadata.notes',
      
      // Tags variations
      'tags': 'metadata.tags',
      'tag': 'metadata.tags',
      'categories': 'metadata.tags',
      'labels': 'metadata.tags',
      
      // Age
      'age': 'metadata.travelerDetails.age',
      
      // Gender
      'gender': 'metadata.travelerDetails.gender',
      'sex': 'metadata.travelerDetails.gender',
      
      // Nationality
      'nationality': 'metadata.travelerDetails.nationality',
      'country': 'metadata.travelerDetails.nationality',
      
      // Emergency contact
      'emergency_contact': 'metadata.travelerDetails.emergencyContact',
      'emergency_phone': 'metadata.travelerDetails.emergencyContact',
      
      // Medical conditions
      'medical_conditions': 'metadata.travelerDetails.medicalConditions',
      'health_conditions': 'metadata.travelerDetails.medicalConditions',
      'medical_info': 'metadata.travelerDetails.medicalConditions',
      
      // Dietary preferences
      'dietary_preferences': 'metadata.travelerDetails.dietaryPreferences',
      'diet': 'metadata.travelerDetails.dietaryPreferences',
      'food_preferences': 'metadata.travelerDetails.dietaryPreferences',
    };

    for (const [sourceField, value] of Object.entries(sampleRecord)) {
      const normalizedField = sourceField.toLowerCase().trim().replace(/\s+/g, '_');
      const targetField = fieldMappings[normalizedField];
      
      if (targetField) {
        mapping.push({
          sourceField,
          targetField
        });
      }
    }

    return mapping;
  }

  /**
   * Apply field transformations
   */
  private applyTransform(value: any, transform?: string): any {
    if (!transform || !value) return value;

    switch (transform) {
      case 'lowercase':
        return String(value).toLowerCase();
      case 'uppercase':
        return String(value).toUpperCase();
      case 'trim':
        return String(value).trim();
      case 'phone_format':
        // Remove all non-numeric characters except +
        return String(value).replace(/[^\d+]/g, '');
      case 'email_normalize':
        return String(value).toLowerCase().trim();
      case 'split_comma':
        return String(value).split(',').map(s => s.trim());
      case 'to_number':
        return Number(value);
      case 'to_boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  /**
   * Map source data to Lead model
   */
  private mapToLead(
    sourceData: any,
    fieldMapping: FieldMapping[],
    organizerId: string,
    config: ImportConfig
  ): any {
    // Field-mapping targets are stored strings like 'metadata.notes' and
    // 'metadata.travelerDetails.age' - written when metadata was one nested blob
    // on the document. Those columns are flat now, and travelerDetails is JSON,
    // so the targets are translated rather than written through literally.
    //
    // This is not cosmetic. Building { metadata: {...}, interactions: [] } and
    // handing it to prisma.lead.create fails at runtime with unknown fields, and
    // TypeScript cannot see it because leadData is `any`.
    const COLUMN_FOR: Record<string, string> = {
      'metadata.notes': 'notes',
      'metadata.tags': 'tags',
      'metadata.inquiryMessage': 'inquiryMessage',
      'metadata.tripViewCount': 'tripViewCount',
      'metadata.lastVisitedAt': 'lastVisitedAt',
      'metadata.kycStatus': 'kycStatus'
    };

    const leadData: any = {
      assignedTo: config.autoAssignToOrganizer ? organizerId : undefined,
      source: config.defaultLeadSource || 'form',
      status: config.defaultLeadStatus || 'new',
      leadScore: 0,
      tags: config.defaultTags || []
    };
    const travelerDetails: Record<string, any> = {};

    for (const mapping of fieldMapping) {
      let value = sourceData[mapping.sourceField];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      // Apply transformation
      value = this.applyTransform(value, mapping.transform);

      const target = mapping.targetField;

      // metadata.travelerDetails.* keeps its nesting, inside the JSON column.
      if (target.startsWith('metadata.travelerDetails.')) {
        travelerDetails[target.slice('metadata.travelerDetails.'.length)] = value;
        continue;
      }

      const column = COLUMN_FOR[target] ?? target;

      if (column === 'tags' && typeof value === 'string') {
        leadData.tags = value.split(',').map((t: string) => t.trim());
      } else if (column === 'email' && typeof value === 'string') {
        // The column is lowercase-only, so normalise rather than be refused.
        leadData.email = value.toLowerCase().trim();
      } else {
        leadData[column] = value;
      }
    }

    if (Object.keys(travelerDetails).length > 0) {
      leadData.travelerDetails = travelerDetails;
    }

    return leadData;
  }

  /**
   * Validate lead data
   */
  private validateLeadData(leadData: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Email is required
    if (!leadData.email) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadData.email)) {
      errors.push('Invalid email format');
    }

    // Validate phone format if provided
    if (leadData.phone && !/^[+]?[1-9]\d{1,14}$/.test(leadData.phone)) {
      errors.push('Invalid phone format');
    }

    // Validate status
    const validStatuses = ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'];
    if (leadData.status && !validStatuses.includes(leadData.status)) {
      errors.push(`Invalid status: ${leadData.status}`);
    }

    // Validate source
    const validSources = ['trip_view', 'inquiry', 'partial_booking', 'chat', 'form', 'other'];
    if (leadData.source && !validSources.includes(leadData.source)) {
      errors.push(`Invalid source: ${leadData.source}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for duplicate lead
   */
  private async checkDuplicate(email: string, organizerId: string): Promise<boolean> {
    // (email, assignedTo) is a unique constraint now, so this is a fast path
    // rather than the thing that actually prevents the duplicate.
    const existing = await prisma.lead.findFirst({
      where: { email: email.toLowerCase(), assignedTo: organizerId }
    });
    return !!existing;
  }

  /**
   * Import database
   */
  async importDatabase(
    file: Express.Multer.File,
    organizerId: string,
    fieldMapping?: FieldMapping[],
    config?: ImportConfig
  ): Promise<ImportResult> {
    const startTime = Date.now();
    
    try {
      // Parse file based on type
      let records: any[] = [];
      const fileType = file.mimetype.includes('csv') ? 'csv' :
                      file.mimetype.includes('sheet') || file.mimetype.includes('excel') ? 'xlsx' :
                      'json';

      switch (fileType) {
        case 'csv':
          records = await this.parseCSV(file.buffer);
          break;
        case 'xlsx':
          records = this.parseExcel(file.buffer);
          break;
        case 'json':
          records = this.parseJSON(file.buffer);
          break;
        default:
          throw new Error('Unsupported file type');
      }

      if (records.length === 0) {
        throw new Error('No records found in file');
      }

      // Auto-detect field mapping if not provided
      if (!fieldMapping || fieldMapping.length === 0) {
        fieldMapping = this.autoDetectFieldMapping(records[0]);
      }

      // Create import record
      const importRecord = await prisma.importedDatabase.create({
        data: {
        organizerId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType,
        status: 'processing',
        fieldMapping: fieldMapping as any,
        config: {
          skipDuplicates: config?.skipDuplicates ?? true,
          updateExisting: config?.updateExisting ?? false,
          validateData: config?.validateData ?? true,
          autoAssignToOrganizer: config?.autoAssignToOrganizer ?? true,
          defaultLeadSource: config?.defaultLeadSource || 'form',
          defaultLeadStatus: config?.defaultLeadStatus || 'new',
          defaultTags: config?.defaultTags || []
        },
        statsTotalRecords: records.length,
        statsSuccessfulImports: 0,
        statsFailedImports: 0,
        statsDuplicatesSkipped: 0,
        totalRows: records.length,
        importErrors: [],
        importedLeadIds: []
        }
      });

      // Process records
      const importedLeadIds: string[] = [];
      const errors: any[] = [];
      let successCount = 0;
      let failCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < records.length; i++) {
        try {
          const record = records[i];
          
          // Map to lead data
          const leadData = this.mapToLead(record, fieldMapping, organizerId, config || {});

          // Validate
          if (config?.validateData !== false) {
            const validation = this.validateLeadData(leadData);
            if (!validation.valid) {
              errors.push({
                row: i + 1,
                error: validation.errors.join(', '),
                timestamp: new Date()
              });
              failCount++;
              continue;
            }
          }

          // Check for duplicates
          if (config?.skipDuplicates !== false) {
            const isDuplicate = await this.checkDuplicate(leadData.email, organizerId);
            if (isDuplicate) {
              if (config?.updateExisting) {
                // Update existing lead
                await prisma.lead.updateMany({
                  where: { email: leadData.email.toLowerCase(), assignedTo: organizerId },
                  data: leadData
                });
                successCount++;
              } else {
                duplicateCount++;
              }
              continue;
            }
          }

          // Create lead
          const lead = await prisma.lead.create({ data: leadData });
          importedLeadIds.push(lead.id);
          successCount++;

        } catch (error: any) {
          errors.push({
            row: i + 1,
            error: error.message,
            timestamp: new Date()
          });
          failCount++;
        }
      }

      // Update import record
      const processingTime = Date.now() - startTime;
      const stats = {
        totalRecords: records.length,
        successfulImports: successCount,
        failedImports: failCount,
        duplicatesSkipped: duplicateCount,
        processingTime
      };

      const finished = await prisma.importedDatabase.update({
        where: { id: importRecord.id },
        data: {
          status: failCount === 0 ? 'completed' :
                  successCount > 0 ? 'partially_completed' : 'failed',
          statsTotalRecords: stats.totalRecords,
          statsSuccessfulImports: stats.successfulImports,
          statsFailedImports: stats.failedImports,
          statsDuplicatesSkipped: stats.duplicatesSkipped,
          statsProcessingTime: stats.processingTime,
          processedRows: records.length,
          progressPercentage: 100,
          importErrors: errors,
          // The ids rollback will delete. Written in the same statement as the
          // final status, so a completed import always knows what it created -
          // there is no window where it is done but cannot be undone.
          importedLeadIds
        }
      });

      logger.info('Database import completed', {
        importId: finished.id,
        organizerId,
        stats
      });

      return {
        success: successCount > 0,
        importId: finished.id,
        stats: {
          totalRecords: records.length,
          successfulImports: successCount,
          failedImports: failCount,
          duplicatesSkipped: duplicateCount
        },
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error: any) {
      logger.error('Database import failed', {
        organizerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get import history
   */
  async getImportHistory(organizerId: string, limit: number = 10) {
    // importErrors is left out of the list view, as select('-importErrors') did:
    // a failed import of ten thousand rows carries ten thousand error objects.
    return await prisma.importedDatabase.findMany({
      where: { organizerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      omit: { importErrors: true }
    });
  }

  /**
   * Get import details
   */
  async getImportDetails(importId: string, organizerId: string) {
    // Scoped by organizerId as well as id, so one organizer cannot read
    // another's import by guessing an id.
    return await prisma.importedDatabase.findFirst({
      where: { id: importId, organizerId }
    });
  }

  /**
   * Rollback import
   */
  async rollbackImport(importId: string, organizerId: string): Promise<boolean> {
    const importRecord = await prisma.importedDatabase.findFirst({
      where: { id: importId, organizerId }
    });

    if (!importRecord) {
      throw new Error('Import record not found');
    }

    if (!importRecord.canRollback) {
      throw new Error('This import cannot be rolled back');
    }

    if (importRecord.rolledBackAt) {
      throw new Error('This import has already been rolled back');
    }

    // Delete all imported leads
    await prisma.lead.deleteMany({
      where: { id: { in: importRecord.importedLeadIds } }
    });

    // Mark as rolled back
    await prisma.importedDatabase.update({
      where: { id: importRecord.id },
      data: { rolledBackAt: new Date(), canRollback: false }
    });

    logger.info('Import rolled back', {
      importId,
      organizerId,
      deletedLeads: importRecord.importedLeadIds.length
    });

    return true;
  }

  /**
   * Get sample data for field mapping preview
   */
  async getSampleData(file: Express.Multer.File, rows: number = 5): Promise<any[]> {
    const fileType = file.mimetype.includes('csv') ? 'csv' :
                    file.mimetype.includes('sheet') || file.mimetype.includes('excel') ? 'xlsx' :
                    'json';

    let records: any[] = [];

    switch (fileType) {
      case 'csv':
        records = await this.parseCSV(file.buffer);
        break;
      case 'xlsx':
        records = this.parseExcel(file.buffer);
        break;
      case 'json':
        records = this.parseJSON(file.buffer);
        break;
    }

    return records.slice(0, rows);
  }
}

export const databaseImportService = new DatabaseImportService();
