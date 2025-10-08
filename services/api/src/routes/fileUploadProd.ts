import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { auth } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';
import { wrapRoute, wrapMulterRoute, AuthenticatedRequest } from '../utils/routeWrapper';

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
    files: 10
  }
});

// Profile photo upload
router.post('/profile-photo', auth, (upload.single('profilePhoto') as any), wrapMulterRoute(async (req: AuthenticatedRequest, res) => {
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
  user.profilePhoto = req.file.path.replace(/\\/g, '/');
  await user.save();

  res.json({
    success: true,
    message: 'Profile photo uploaded successfully',
    data: {
      profilePhoto: user.profilePhoto,
      url: `${req.protocol}://${req.get('host')}/${user.profilePhoto}`
    }
  });
}));

// Cover photo upload
router.post('/cover-photo', auth, (upload.single('coverPhoto') as any), wrapMulterRoute(async (req: AuthenticatedRequest, res) => {
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
}));

// QR code upload 
router.post('/qr-code', auth, (upload.single('qrCode') as any), wrapMulterRoute(async (req: AuthenticatedRequest, res) => {
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
}));

// Get user files
router.get('/user-files', auth, wrapRoute(async (req: AuthenticatedRequest, res) => {
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
    qrCodes: user.organizerProfile?.qrCodes?.map(qr => ({
      ...qr,
      url: `${req.protocol}://${req.get('host')}/${qr.path}`
    })) || []
  };

  res.json({
    success: true,
    data: userFiles
  });
}));

export default router;