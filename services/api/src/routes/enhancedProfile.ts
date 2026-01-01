import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { SupportTicket } from '../models/SupportTicket';
import { logger } from '../utils/logger';
import { extractTokenFromHeaders } from '../utils/tokenHelper';
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
 * @access Public (all profiles viewable, role-based content)
 */
router.get('/enhanced/:userId?', async (req, res) => {
  try {
    // Try to extract user from token if present (optional authentication)
    // Also check cookies for session-based auth
    let requestingUserId: string | undefined;

    // Try to extract token from cookies or Authorization header
    const token = extractTokenFromHeaders(req.headers) || req.cookies?.token || req.cookies?.authToken;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        // Handle both 'userId' and 'id' for backward compatibility
        requestingUserId = decoded.userId || decoded.id || decoded._id || decoded.sub;
      } catch (err) {
        // Invalid token, continue without authentication
        logger.debug('Token verification failed (optional auth)', { error: (err as Error).message });
      }
    }

    // If no token, try to get from req.user if authenticateToken middleware was applied
    if (!requestingUserId && (req as any).user) {
      requestingUserId = (req as any).user.id || (req as any).user.userId || (req as any).user._id;
    }

    const userId = req.params.userId || requestingUserId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required. Please provide userId in the URL path (e.g., /profile/enhanced/USER_ID) or ensure you are authenticated.',
        statusCode: 400
      });
    }

    // Validate MongoDB ObjectId format
    const mongooseObjectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!mongooseObjectIdRegex.test(userId)) {
      logger.info('Invalid user ID format provided', { userId });
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    console.log('Fetching profile:', userId);
    const user = await User.findById(userId).select('-passwordHash -resetPasswordToken');

    if (!user) {
      logger.info('User not found', { userId });
      return res.status(404).json({
        success: false,
        message: 'User not found',
        statusCode: 404
      });
    }

    // Check if viewing own profile
    const isOwnProfile = requestingUserId === userId;

    // All profiles are now public, but show different content based on role
    let profileData: any = user.toObject();

    // Filter sensitive information for non-owners
    if (!isOwnProfile) {
      // Hide sensitive fields from non-owners
      profileData.email = user.email; // Show email for contact
      profileData.phone = undefined; // Hide phone
      profileData.emergencyContact = undefined;
      profileData.resetPasswordExpires = undefined;
      profileData.verificationDocuments = undefined;
    }

    // Role-based content visibility
    // Organizers get: profile, portfolio, followers, posts, stats
    // Travellers get: profile, following, past trips, wishlists
    let roleSpecificData: any = {};

    if (user.role === 'organizer') {
      // Organizers: full profile with portfolio
      roleSpecificData = {
        portfolioVisible: true,
        postsVisible: true,
        followersVisible: true,
        statsVisible: true,
        canPost: isOwnProfile,
      };
    } else if (user.role === 'traveler') {
      // Travellers: basic profile only
      roleSpecificData = {
        portfolioVisible: false,
        postsVisible: false,
        followersVisible: true,
        statsVisible: false,
        canPost: isOwnProfile,
        showPastTrips: true,
        showWishlists: true,
      };
    } else {
      // Other roles
      roleSpecificData = {
        portfolioVisible: false,
        postsVisible: false,
        followersVisible: false,
        statsVisible: false,
        canPost: false,
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        user: profileData,
        isOwnProfile,
        roleBasedData: roleSpecificData
      },
      statusCode: 200
    });

  } catch (error: any) {
    logger.error('Error fetching enhanced profile', { error: error.message, userId: req.params.userId, stack: error.stack });

    // Specific error handling
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format',
        statusCode: 400
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      statusCode: 500,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

/**
 * @route GET /api/profile/me/stats
 * @description Get simple traveler analytics for the authenticated user
 * @access Private
 */
router.get('/me/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    const [tripsJoined, upcomingTrips, openTickets] = await Promise.all([
      Trip.countDocuments({ participants: userId }),
      Trip.countDocuments({ participants: userId, startDate: { $gte: new Date() } }),
      SupportTicket.countDocuments({ userId })
    ]);

    // Profile completeness heuristic
    const user = await User.findById(userId).select('name profilePhoto bio socialLinks organizerProfile');
    let completeness = 20; // base
    if (user) {
      if (user.name) completeness += 20;
      if (user.profilePhoto) completeness += 20;
      if (user.bio) completeness += 20;
      if (user.socialLinks && Object.values(user.socialLinks).some(Boolean)) completeness += 20;
    }

    res.json({
      success: true,
      stats: {
        tripsJoined,
        upcomingTrips,
        openTickets,
        profileCompleteness: Math.min(100, completeness),
        memberSince: user?.createdAt || null
      }
    });
  } catch (error: any) {
    logger.error('Error fetching profile stats', { error: error.message, userId: req.user?.id });
    res.status(500).json({ success: false, message: 'Failed to fetch profile stats' });
  }
});
