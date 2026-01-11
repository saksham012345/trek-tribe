import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { auth, AuthPayload } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';

import { AuthenticatedRequest } from '../types/app-types';

// Extend Request interface
// interface AuthenticatedRequest extends Request {
//   user: AuthPayload;
//   file?: Express.Multer.File;
//   files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
// }

const router = express.Router();
const unlinkAsync = promisify(fs.unlink);

// Ensure upload directories exist
const uploadDirs = [
  'uploads/profiles',
  'uploads/covers',
  'uploads/trips',
  'uploads/documents',
  'uploads/qr-codes',
  'uploads/temp'
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// File type validation
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedImageTypes = /jpeg|jpg|png|webp/;
  const allowedDocTypes = /pdf|doc|docx/;

  const extname = allowedImageTypes.test(path.extname(file.originalname).toLowerCase()) ||
    allowedDocTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedImageTypes.test(file.mimetype) ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' ||
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only images (jpeg, jpg, png, webp) and documents (pdf, doc, docx) are allowed'));
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/temp';

    if (file.fieldname === 'profilePhoto' || file.fieldname === 'avatar') {
      uploadPath = 'uploads/profiles';
    } else if (file.fieldname === 'coverPhoto' || file.fieldname === 'cover') {
      uploadPath = 'uploads/covers';
    } else if (file.fieldname === 'tripImages' || file.fieldname === 'tripCover') {
      uploadPath = 'uploads/trips';
    } else if (file.fieldname === 'verificationDoc' || file.fieldname === 'document') {
      uploadPath = 'uploads/documents';
    } else if (file.fieldname === 'qrCode') {
      uploadPath = 'uploads/qr-codes';
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  }
});

/**
 * @route POST /api/uploads/profile-photo
 * @description Upload user profile photo
 * @access Private
 */
router.post('/profile-photo', auth as any, upload.single('profilePhoto') as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old profile photo if exists
    if (user.profilePhoto && fs.existsSync(user.profilePhoto)) {
      try {
        await unlinkAsync(user.profilePhoto);
      } catch (error) {
        logger.warn('Failed to delete old profile photo', { error });
      }
    }

    // Update user with new profile photo path
    user.profilePhoto = req.file.path.replace(/\\/g, '/'); // Convert Windows paths to Unix format
    await user.save();

    res.json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        profilePhoto: user.profilePhoto,
        url: `${req.protocol}://${req.get('host')}/${user.profilePhoto}`
      }
    });

  } catch (error: any) {
    logger.error('Error uploading profile photo', { error: error.message, userId: req.user?.id });

    // Clean up uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded file', { cleanupError });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload profile photo'
    });
  }
});

/**
 * @route POST /api/uploads/cover-photo
 * @description Upload user cover photo
 * @access Private
 */
// @ts-ignore
router.post('/cover-photo', auth, upload.single('coverPhoto'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete old cover photo if exists
    if (user.coverPhoto && fs.existsSync(user.coverPhoto)) {
      try {
        await unlinkAsync(user.coverPhoto);
      } catch (error) {
        logger.warn('Failed to delete old cover photo', { error });
      }
    }

    // Update user with new cover photo path
    user.coverPhoto = req.file.path.replace(/\\/g, '/');
    await user.save();

    res.json({
      success: true,
      message: 'Cover photo uploaded successfully',
      data: {
        coverPhoto: user.coverPhoto,
        url: `${req.protocol}://${req.get('host')}/${user.coverPhoto}`
      }
    });

  } catch (error: any) {
    logger.error('Error uploading cover photo', { error: error.message, userId: req.user?.id });

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded file', { cleanupError });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload cover photo'
    });
  }
});

/**
 * @route POST /api/uploads/verification-documents
 * @description Upload verification documents
 * @access Private
 */
// @ts-ignore
router.post('/verification-documents', auth, upload.array('documents', 5), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const uploadedDocs = files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path.replace(/\\/g, '/'),
      size: file.size,
      mimetype: file.mimetype,
      uploadedAt: new Date(),
      verified: false
    }));

    // Initialize verificationDocuments if not exists
    if (!user.verificationDocuments) {
      user.verificationDocuments = [];
    }

    // Add new documents
    user.verificationDocuments.push(...uploadedDocs);
    await user.save();

    res.json({
      success: true,
      message: 'Verification documents uploaded successfully',
      data: {
        uploadedDocuments: uploadedDocs.map(doc => ({
          ...doc,
          url: `${req.protocol}://${req.get('host')}/${doc.path}`
        }))
      }
    });

  } catch (error: any) {
    logger.error('Error uploading verification documents', { error: error.message, userId: req.user?.id });

    // Clean up uploaded files on error
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          try {
            await unlinkAsync(file.path);
          } catch (cleanupError) {
            logger.error('Failed to cleanup uploaded file', { cleanupError });
          }
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload verification documents'
    });
  }
});

/**
 * @route POST /api/uploads/trip-images/:tripId
 * @description Upload trip images
 * @access Private
 */
// @ts-ignore
router.post('/trip-images/:tripId', auth, upload.array('tripImages', 10), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const trip = await Trip.findById(req.params.tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Check if user is the organizer
    if (trip.organizerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the trip organizer can upload images'
      });
    }

    const uploadedImages = files.map(file => ({
      filename: file.filename,
      path: file.path.replace(/\\/g, '/'),
      url: `${req.protocol}://${req.get('host')}/${file.path.replace(/\\/g, '/')}`,
      size: file.size,
      uploadedAt: new Date()
    }));

    // Add images to trip
    if (!trip.images) {
      trip.images = [];
    }
    trip.images.push(...uploadedImages.map(img => img.path));

    // Set first image as cover if no cover exists
    if (!trip.coverImage && uploadedImages.length > 0) {
      trip.coverImage = uploadedImages[0].path;
    }

    await trip.save();

    res.json({
      success: true,
      message: 'Trip images uploaded successfully',
      data: {
        uploadedImages,
        totalImages: trip.images.length
      }
    });

  } catch (error: any) {
    logger.error('Error uploading trip images', { error: error.message, tripId: req.params.tripId });

    if (req.files) {
      const files = req.files as Express.Multer.File[];
      for (const file of files) {
        if (fs.existsSync(file.path)) {
          try {
            await unlinkAsync(file.path);
          } catch (cleanupError) {
            logger.error('Failed to cleanup uploaded file', { cleanupError });
          }
        }
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload trip images'
    });
  }
});

/**
 * @route POST /api/uploads/qr-code
 * @description Upload QR code for payment
 * @access Private
 */
// @ts-ignore
router.post('/qr-code', auth, upload.single('qrCode'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No QR code file uploaded'
      });
    }

    const { paymentMethod, description } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'organizer') {
      return res.status(403).json({
        success: false,
        message: 'Only organizers can upload QR codes'
      });
    }

    const qrCodeData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path.replace(/\\/g, '/'),
      paymentMethod: paymentMethod || 'UPI',
      description: description || '',
      uploadedAt: new Date(),
      isActive: true
    };

    // Initialize organizerProfile.qrCodes if not exists
    if (!user.organizerProfile) {
      user.organizerProfile = {};
    }
    if (!user.organizerProfile.qrCodes) {
      user.organizerProfile.qrCodes = [];
    }

    // Add new QR code
    user.organizerProfile.qrCodes.push(qrCodeData);
    await user.save();

    res.json({
      success: true,
      message: 'QR code uploaded successfully',
      data: {
        qrCode: {
          ...qrCodeData,
          url: `${req.protocol}://${req.get('host')}/${qrCodeData.path}`
        }
      }
    });

  } catch (error: any) {
    logger.error('Error uploading QR code', { error: error.message, userId: req.user?.id });

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await unlinkAsync(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded file', { cleanupError });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload QR code'
    });
  }
});

/**
 * @route DELETE /api/uploads/file/:filepath
 * @description Delete uploaded file
 * @access Private
 */
router.delete('/file/:filepath(*)', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const filepath = req.params.filepath;
    const fullPath = path.resolve(filepath);

    // Security check: ensure the file is within uploads directory
    if (!fullPath.includes(path.resolve('uploads'))) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if user has permission to delete this file
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (fs.existsSync(fullPath)) {
      await unlinkAsync(fullPath);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error: any) {
    logger.error('Error deleting file', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to delete file'
    });
  }
});

/**
 * @route GET /api/uploads/user-files
 * @description Get user's uploaded files
 * @access Private
 */
router.get('/user-files', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.user.id).select('profilePhoto coverPhoto verificationDocuments organizerProfile.qrCodes');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userFiles = {
      profilePhoto: user.profilePhoto ? {
        path: user.profilePhoto,
        url: `${req.protocol}://${req.get('host')}/${user.profilePhoto}`
      } : null,
      coverPhoto: user.coverPhoto ? {
        path: user.coverPhoto,
        url: `${req.protocol}://${req.get('host')}/${user.coverPhoto}`
      } : null,
      verificationDocuments: user.verificationDocuments?.map(doc => ({
        ...doc,
        url: `${req.protocol}://${req.get('host')}/${doc.path}`
      })) || [],
      qrCodes: user.organizerProfile?.qrCodes?.map(qr => ({
        ...qr,
        url: `${req.protocol}://${req.get('host')}/${qr.path}`
      })) || []
    };

    res.json({
      success: true,
      data: userFiles
    });

  } catch (error: any) {
    logger.error('Error fetching user files', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user files'
    });
  }
});

export default router;