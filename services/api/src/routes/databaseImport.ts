import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { databaseImportService } from '../services/databaseImportService';
import { importQueue } from '../workers/importWorker';
import ImportedDatabase from '../models/ImportedDatabase';
import CRMSubscription from '../models/CRMSubscription';
import { logger } from '../utils/logger';

const router = Router();

// 10 imports per hour per organizer
const importRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req: any) => req.auth?.userId || req.ip,
  message: { success: false, error: 'Import limit exceeded. Maximum 10 imports per hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, Excel, and JSON files are allowed.'));
    }
  }
});

// Middleware to check CRM access
const checkCRMAccess = async (req: any, res: any, next: any) => {
  try {
    const organizerId = req.auth.userId;
    
    // Check if organizer has CRM access
    const subscription = await CRMSubscription.findOne({
      organizerId,
      status: 'active',
      'crmBundle.hasAccess': true
    });

    if (!subscription) {
      return res.status(403).json({
        success: false,
        error: 'CRM access required',
        message: 'You need an active CRM subscription to import databases. Please upgrade your plan.'
      });
    }

    req.crmSubscription = subscription;
    next();
  } catch (error: any) {
    logger.error('Error checking CRM access', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Failed to verify CRM access'
    });
  }
};

/**
 * @route   POST /api/database-import/preview
 * @desc    Preview sample data from uploaded file for field mapping
 * @access  Private (Organizer with CRM access)
 */
router.post(
  '/preview',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  upload.single('file'),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const rows = parseInt(req.query.rows as string) || 5;
      const sampleData = await databaseImportService.getSampleData(req.file, rows);
      
      // Auto-detect field mapping
      const suggestedMapping = sampleData.length > 0 
        ? databaseImportService.autoDetectFieldMapping(sampleData[0])
        : [];

      return res.json({
        success: true,
        data: {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          sampleRecords: sampleData,
          suggestedMapping,
          availableFields: sampleData.length > 0 ? Object.keys(sampleData[0]) : []
        }
      });
    } catch (error: any) {
      logger.error('Error previewing file', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to preview file',
        message: error.message
      });
    }
  }
);

/**
 * @route   POST /api/database-import/import
 * @desc    Queue import job (async)
 * @access  Private (Organizer with CRM access)
 */
router.post(
  '/import',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  importRateLimit,
  upload.single('file'),
  async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const organizerId = req.auth.userId;

      const config = {
        skipDuplicates: req.body.skipDuplicates !== 'false',
        updateExisting: req.body.updateExisting === 'true',
        validateData: req.body.validateData !== 'false',
        autoAssignToOrganizer: req.body.autoAssignToOrganizer !== 'false',
        defaultLeadSource: req.body.defaultLeadSource || 'form',
        defaultLeadStatus: req.body.defaultLeadStatus || 'new',
        defaultTags: req.body.defaultTags ? JSON.parse(req.body.defaultTags) : [],
      };

      let fieldMapping;
      if (req.body.fieldMapping) {
        fieldMapping = JSON.parse(req.body.fieldMapping);
      }

      // Get row count estimate from preview
      const sampleData = await databaseImportService.getSampleData(req.file, 1);
      const fileType = req.file.mimetype.includes('csv') ? 'csv' :
        req.file.mimetype.includes('sheet') || req.file.mimetype.includes('excel') ? 'xlsx' : 'json';

      // Create Import_Record immediately
      const importRecord = await ImportedDatabase.create({
        organizerId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType,
        status: 'processing',
        fieldMapping: fieldMapping || (sampleData.length > 0 ? databaseImportService.autoDetectFieldMapping(sampleData[0]) : []),
        config,
        stats: { totalRecords: 0, successfulImports: 0, failedImports: 0, duplicatesSkipped: 0 },
        importErrors: [],
        importedLeadIds: [],
        processedRows: 0,
        totalRows: 0,
        progressPercentage: 0,
      });

      // Push to queue
      await importQueue.add({
        importId: importRecord._id.toString(),
        organizerId,
        fileBuffer: req.file.buffer.toString('base64'),
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        fieldMapping: importRecord.fieldMapping,
        config,
      });

      return res.status(202).json({
        success: true,
        importId: importRecord._id.toString(),
        message: 'Import queued. Use the importId to track progress.',
      });
    } catch (error: any) {
      logger.error('Error queuing import', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to queue import', message: error.message });
    }
  }
);

/**
 * @route   GET /api/database-import/:importId/status
 * @desc    Poll import progress
 * @access  Private (Organizer with CRM access)
 */
router.get(
  '/:importId/status',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  async (req: any, res) => {
    try {
      const { importId } = req.params;
      const organizerId = req.auth.userId;

      const record = await ImportedDatabase.findOne({ _id: importId, organizerId })
        .select('status processedRows totalRows progressPercentage stats importErrors')
        .lean();

      if (!record) {
        return res.status(404).json({ success: false, error: 'Import record not found' });
      }

      return res.json({
        success: true,
        data: {
          status: record.status,
          processedRows: record.processedRows,
          totalRows: record.totalRows,
          progressPercentage: record.progressPercentage,
          stats: record.stats,
          errorCount: record.importErrors?.length ?? 0,
        },
      });
    } catch (error: any) {
      logger.error('Error fetching import status', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to fetch import status' });
    }
  }
);

/**
 * @route   GET /api/database-import/history
 * @desc    Get import history for organizer
 * @access  Private (Organizer with CRM access)
 */
router.get(
  '/history',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  async (req: any, res) => {
    try {
      const organizerId = req.auth.userId;
      const limit = parseInt(req.query.limit as string) || 10;

      const history = await databaseImportService.getImportHistory(organizerId, limit);

      return res.json({
        success: true,
        data: history
      });
    } catch (error: any) {
      logger.error('Error fetching import history', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch import history'
      });
    }
  }
);

/**
 * @route   GET /api/database-import/:importId
 * @desc    Get detailed import information
 * @access  Private (Organizer with CRM access)
 */
router.get(
  '/:importId',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  async (req: any, res) => {
    try {
      const organizerId = req.auth.userId;
      const { importId } = req.params;

      const importDetails = await databaseImportService.getImportDetails(importId, organizerId);

      if (!importDetails) {
        return res.status(404).json({
          success: false,
          error: 'Import record not found'
        });
      }

      return res.json({
        success: true,
        data: importDetails
      });
    } catch (error: any) {
      logger.error('Error fetching import details', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch import details'
      });
    }
  }
);

/**
 * @route   POST /api/database-import/:importId/rollback
 * @desc    Rollback an import (delete all imported leads)
 * @access  Private (Organizer with CRM access)
 */
router.post(
  '/:importId/rollback',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  async (req: any, res) => {
    try {
      const organizerId = req.auth.userId;
      const { importId } = req.params;

      const success = await databaseImportService.rollbackImport(importId, organizerId);

      return res.json({
        success,
        message: 'Import rolled back successfully. All imported leads have been deleted.'
      });
    } catch (error: any) {
      logger.error('Error rolling back import', { error: error.message });
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/database-import/template/download
 * @desc    Download CSV template for database import
 * @access  Private (Organizer with CRM access)
 */
router.get(
  '/template/download',
  authenticateJwt,
  requireRole(['organizer']),
  checkCRMAccess,
  async (req: any, res) => {
    try {
      const template = `email,name,phone,status,source,notes,tags,age,gender,nationality,emergency_contact,medical_conditions,dietary_preferences
john.doe@example.com,John Doe,+919876543210,new,form,Interested in Himalayan trek,"adventure,trekking",28,male,Indian,+919876543211,None,Vegetarian
jane.smith@example.com,Jane Smith,+919876543220,contacted,inquiry,Looking for family trip,"family,leisure",35,female,American,+919876543221,Asthma,Non-vegetarian
`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=trek-tribe-import-template.csv');
      return res.send(template);
    } catch (error: any) {
      logger.error('Error downloading template', { error: error.message });
      return res.status(500).json({
        success: false,
        error: 'Failed to download template'
      });
    }
  }
);

export default router;
