import express from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import { authenticateJwt, requireRole } from '../middleware/auth';
import { razorpayKycService } from '../services/razorpayKycService';
import { idVerificationService } from '../services/idVerificationService';
import { fileHandler } from '../utils/fileHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPG, PNG) and PDF files are allowed'));
    }
  },
});

/**
 * Razorpay KYC Routes
 */

// Create Razorpay account (organizers only)
const createAccountSchema = z.object({
  legal_business_name: z.string().min(1),
  business_type: z.enum(['proprietorship', 'partnership', 'private_limited', 'public_limited', 'llp']),
  contact_name: z.string().min(1),
  category: z.string().default('travel_and_tourism'),
  subcategory: z.string().default('tour_operators'),
  street1: z.string().min(1),
  street2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postal_code: z.string().min(1),
  country: z.string().default('IN'),
});

router.post('/razorpay/create-account', authenticateJwt, requireRole(['organizer', 'admin']), async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { User } = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const parsed = createAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
    }

    const data = parsed.data;

    const result = await razorpayKycService.createAccount(userId, {
      email: user.email,
      phone: user.phone || '',
      legal_business_name: data.legal_business_name,
      business_type: data.business_type,
      contact_name: data.contact_name,
      profile: {
        category: data.category,
        subcategory: data.subcategory,
        addresses: {
          registered: {
            street1: data.street1,
            street2: data.street2,
            city: data.city,
            state: data.state,
            postal_code: data.postal_code,
            country: data.country,
          },
        },
      },
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      accountId: result.accountId,
      message: 'Razorpay account created successfully',
    });
  } catch (error: any) {
    logger.error('Error creating Razorpay account', { error: error.message });
    res.status(500).json({ error: 'Failed to create Razorpay account' });
  }
});

// Submit KYC documents
router.post(
  '/razorpay/submit-kyc',
  authenticateJwt,
  requireRole(['organizer', 'admin']),
  upload.fields([
    { name: 'business_proof', maxCount: 1 },
    { name: 'business_pan', maxCount: 1 },
    { name: 'promoter_address', maxCount: 1 },
    { name: 'business_operation_proof', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = (req as any).auth.userId;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({ error: 'Please upload at least one document' });
      }

      const documents: any = {};

      // Upload files and get URLs
      for (const [fieldName, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray[0]) {
          const file = fileArray[0];
          const uploadResult = await fileHandler.saveBufferToFile(
            file.buffer,
            file.originalname,
            file.mimetype
          );

          if (uploadResult && uploadResult.url) {
            documents[`${fieldName}_url`] = uploadResult.url;
          }
        }
      }

      const result = await razorpayKycService.submitKycDocuments(userId, documents);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({
        success: true,
        stakeholderId: result.stakeholderId,
        message: 'KYC documents submitted successfully',
      });
    } catch (error: any) {
      logger.error('Error submitting KYC documents', { error: error.message });
      res.status(500).json({ error: 'Failed to submit KYC documents' });
    }
  }
);

// Check KYC status
router.get('/razorpay/kyc-status', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const result = await razorpayKycService.checkKycStatus(userId);

    res.json(result);
  } catch (error: any) {
    logger.error('Error checking KYC status', { error: error.message });
    res.status(500).json({ error: 'Failed to check KYC status' });
  }
});

// Approve KYC (admin only)
router.post('/razorpay/approve-kyc/:userId', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const adminId = (req as any).auth.userId;
    const { userId } = req.params;

    const result = await razorpayKycService.approveKyc(userId, adminId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'KYC approved successfully' });
  } catch (error: any) {
    logger.error('Error approving KYC', { error: error.message });
    res.status(500).json({ error: 'Failed to approve KYC' });
  }
});

// Reject KYC (admin only)
router.post('/razorpay/reject-kyc/:userId', authenticateJwt, requireRole(['admin']), async (req, res) => {
  try {
    const adminId = (req as any).auth.userId;
    const { userId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await razorpayKycService.rejectKyc(userId, reason, adminId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true, message: 'KYC rejected' });
  } catch (error: any) {
    logger.error('Error rejecting KYC', { error: error.message });
    res.status(500).json({ error: 'Failed to reject KYC' });
  }
});

/**
 * ID Verification Routes (Travelers)
 */

// Submit ID for verification
const submitIdSchema = z.object({
  documentType: z.enum(['aadhaar', 'pan', 'passport', 'driving_license', 'voter_id']),
  documentNumber: z.string().min(1),
  expiryDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
});

router.post(
  '/id-verification/submit',
  authenticateJwt,
  upload.fields([
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const userId = (req as any).auth.userId;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!files || !files.documentFront || files.documentFront.length === 0) {
        return res.status(400).json({ error: 'Please upload document front image' });
      }

      const parsed = submitIdSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid data', details: parsed.error.flatten() });
      }

      const data = parsed.data;

      // Upload front image
      const frontUpload = await fileHandler.saveBufferToFile(
        files.documentFront[0].buffer,
        files.documentFront[0].originalname,
        files.documentFront[0].mimetype
      );

      if (!frontUpload || !frontUpload.url) {
        return res.status(500).json({ error: 'Failed to upload document front' });
      }

      let backUrl: string | undefined;

      // Upload back image if provided
      if (files.documentBack && files.documentBack[0]) {
        const backUpload = await fileHandler.saveBufferToFile(
          files.documentBack[0].buffer,
          files.documentBack[0].originalname,
          files.documentBack[0].mimetype
        );

        if (backUpload && backUpload.url) {
          backUrl = backUpload.url;
        }
      }

      const result = await idVerificationService.submitIdVerification(userId, {
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        documentFront: frontUpload.url,
        documentBack: backUrl,
        expiryDate: data.expiryDate,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error: any) {
      logger.error('Error submitting ID verification', { error: error.message });
      res.status(500).json({ error: 'Failed to submit ID verification' });
    }
  }
);

// Get verification status
router.get('/id-verification/status', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const status = await idVerificationService.getVerificationStatus(userId);

    res.json(status);
  } catch (error: any) {
    logger.error('Error getting verification status', { error: error.message });
    res.status(500).json({ error: 'Failed to get verification status' });
  }
});

// Verify traveler ID (admin/organizer action)
router.post(
  '/id-verification/verify/:userId',
  authenticateJwt,
  requireRole(['admin', 'organizer']),
  async (req, res) => {
    try {
      const verifiedBy = (req as any).auth.userId;
      const { userId } = req.params;
      const { approved, rejectionReason } = req.body;

      if (approved === undefined) {
        return res.status(400).json({ error: 'Approval status is required' });
      }

      const result = await idVerificationService.verifyTravelerId(
        userId,
        verifiedBy,
        approved,
        rejectionReason
      );

      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }

      res.json({ success: true, message: result.message });
    } catch (error: any) {
      logger.error('Error verifying traveler ID', { error: error.message });
      res.status(500).json({ error: 'Failed to verify ID' });
    }
  }
);

// Check if user can join trip
router.get('/id-verification/can-join-trip/:tripId', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { tripId } = req.params;

    const result = await idVerificationService.canJoinTrip(userId, tripId);

    res.json(result);
  } catch (error: any) {
    logger.error('Error checking join eligibility', { error: error.message });
    res.status(500).json({ error: 'Failed to check eligibility' });
  }
});

export default router;
