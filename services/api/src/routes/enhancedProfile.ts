import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * @route GET /api/profile/enhanced/:userId?
 * @description Get enhanced user profile
 * @access Public/Private (depends on privacy settings)
 */
router.get('/enhanced/:userId?', async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;
    const requestingUserId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const user = await User.findById(userId).select('-passwordHash -resetPasswordToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check privacy settings
    const isOwnProfile = requestingUserId === userId;
    const privacySettings = user.privacySettings || { 
      profileVisibility: 'public' as const,
      showEmail: false,
      showPhone: false, 
      showLocation: true 
    };

    if (!isOwnProfile && privacySettings.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Filter sensitive information based on privacy settings
    let profileData: any = user.toObject();

    if (!isOwnProfile) {
      if (!privacySettings.showEmail) {
        profileData.email = undefined;
      }
      if (!privacySettings.showPhone) {
        profileData.phone = undefined;
      }
      if (!privacySettings.showLocation) {
        profileData.location = undefined;
      }
      
      // Always hide these for non-owners
      profileData.emergencyContact = undefined;
      profileData.resetPasswordExpires = undefined;
      profileData.verificationDocuments = undefined;
    }

    res.json({
      success: true,
      data: {
        user: profileData,
        isOwnProfile
      }
    });

  } catch (error: any) {
    logger.error('Error fetching enhanced profile', { error: error.message, userId: req.params.userId });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

/**
 * @route PUT /api/profile/enhanced
 * @description Update enhanced user profile
 * @access Private
 */
router.put('/enhanced', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const updates = req.body;

    // Validate and sanitize updates
    const allowedFields = [
      'name', 'bio', 'location', 'dateOfBirth', 'gender', 'occupation',
      'phone', 'emergencyContact', 'preferences', 'socialLinks',
      'organizerProfile', 'privacySettings'
    ];

    const filteredUpdates: any = {};
    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Special validation for organizer unique URL
    if (filteredUpdates.organizerProfile?.uniqueUrl) {
      const existingUser = await User.findOne({
        'organizerProfile.uniqueUrl': filteredUpdates.organizerProfile.uniqueUrl,
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'This unique URL is already taken'
        });
      }

      // Validate URL format
      const urlRegex = /^[a-zA-Z0-9-_]{3,30}$/;
      if (!urlRegex.test(filteredUpdates.organizerProfile.uniqueUrl)) {
        return res.status(400).json({
          success: false,
          message: 'Unique URL must be 3-30 characters long and contain only letters, numbers, hyphens, and underscores'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).select('-passwordHash -resetPasswordToken');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user },
      message: 'Profile updated successfully'
    });

  } catch (error: any) {
    logger.error('Error updating enhanced profile', { error: error.message, userId: req.user?.id });
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Unique URL is already taken'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

/**
 * @route POST /api/profile/upload-photo
 * @description Upload profile or cover photo
 * @access Private
 */
router.post('/upload-photo', authenticateToken, async (req, res) => {
  try {
    // Handle file upload manually
    upload.single('photo')(req as any, res as any, async (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      const userId = req.user!.id;
      const { type } = req.body; // 'profile' or 'cover'

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      if (!['profile', 'cover'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Photo type must be either "profile" or "cover"'
        });
      }

      const photoUrl = `/uploads/profiles/${req.file.filename}`;
      const updateField = type === 'profile' ? 'profilePhoto' : 'coverPhoto';

      const user = await User.findByIdAndUpdate(
        userId,
        { [updateField]: photoUrl },
        { new: true }
      ).select('-passwordHash -resetPasswordToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          photoUrl,
          user
        },
        message: `${type === 'profile' ? 'Profile' : 'Cover'} photo updated successfully`
      });
    });
  } catch (error: any) {
    logger.error('Error uploading photo', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo'
    });
  }
});

/**
 * @route POST /api/profile/upload-verification
 * @description Upload verification documents
 * @access Private
 */
router.post('/upload-verification', authenticateToken, async (req, res) => {
  try {
    // Handle file upload manually
    upload.array('documents', 5)(req as any, res as any, async (err: any) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      const userId = req.user!.id;

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const documentUrls = (req.files as Express.Multer.File[]).map(file => `/uploads/profiles/${file.filename}`);

      const user = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { verificationDocuments: { $each: documentUrls } } },
        { new: true }
      ).select('-passwordHash -resetPasswordToken');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: {
          documentUrls,
          user
        },
        message: 'Verification documents uploaded successfully'
      });
    });
  } catch (error: any) {
    logger.error('Error uploading verification documents', { error: error.message, userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: 'Failed to upload verification documents'
    });
  }
});

/**
 * @route POST /api/profile/generate-unique-url
 * @description Generate unique URL suggestion for organizer
 * @access Private
 */
router.post('/generate-unique-url', authenticateToken, async (req, res) => {
  try {
    const { baseName } = req.body;
    
    if (!baseName || baseName.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Base name must be at least 3 characters long'
      });
    }

    // Sanitize base name
    const sanitizedBase = baseName.toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    let suggestion = sanitizedBase;
    let counter = 1;

    // Find an available URL
    while (true) {
      const existing = await User.findOne({ 'organizerProfile.uniqueUrl': suggestion });
      if (!existing) {
        break;
      }
      suggestion = `${sanitizedBase}-${counter}`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 999) {
        return res.status(400).json({
          success: false,
          message: 'Unable to generate unique URL'
        });
      }
    }

    res.json({
      success: true,
      data: { suggestion }
    });

  } catch (error: any) {
    logger.error('Error generating unique URL', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to generate unique URL'
    });
  }
});

/**
 * @route GET /api/profile/organizer/:uniqueUrl
 * @description Get organizer profile by unique URL
 * @access Public
 */
router.get('/organizer/:uniqueUrl', async (req, res) => {
  try {
    const { uniqueUrl } = req.params;

    const user = await User.findOne({ 'organizerProfile.uniqueUrl': uniqueUrl })
      .select('-passwordHash -resetPasswordToken -emergencyContact');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Organizer not found'
      });
    }

    if (user.role !== 'organizer') {
      return res.status(404).json({
        success: false,
        message: 'User is not an organizer'
      });
    }

    // Get organizer's trips count (you might want to add this query based on your trips model)
    // const tripsCount = await Trip.countDocuments({ organizerId: user._id, status: 'active' });

    res.json({
      success: true,
      data: {
        user,
        // tripsCount
      }
    });

  } catch (error: any) {
    logger.error('Error fetching organizer by unique URL', { error: error.message, uniqueUrl: req.params.uniqueUrl });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizer profile'
    });
  }
});

export default router;