import express from 'express';
import { z } from 'zod';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Update profile validation schema
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  dateOfBirth: z.string().optional(),
  profilePhoto: z.string().optional(),
  socialLinks: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().url().optional()
  }).optional(),
  organizerProfile: z.object({
    bio: z.string().max(1000).optional(),
    experience: z.string().max(1000).optional(),
    specialties: z.array(z.string()).optional(),
    certifications: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    yearsOfExperience: z.number().min(0).max(50).optional(),
    achievements: z.array(z.string()).optional()
  }).optional(),
  preferences: z.object({
    categories: z.array(z.string()).optional(),
    budgetRange: z.array(z.number()).length(2).optional(),
    locations: z.array(z.string()).optional()
  }).optional()
});

// Search profiles (MUST be before /:userId to avoid conflict)
router.get('/search', async (req, res) => {
  try {
    const { q, role, location } = req.query;
    
    const query: any = {};
    
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } }
      ];
    }
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    const profiles = await User.find(query)
      .select('name bio profilePhoto location role socialLinks isVerified createdAt')
      .limit(20)
      .sort({ lastActive: -1 });

    res.json({ profiles });
  } catch (error: any) {
    logger.error('Error searching profiles', { error: error.message });
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

// Get current user profile
router.get('/me', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const user = await User.findById(userId).select('-passwordHash');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    logger.error('Error fetching user profile', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get profile by user ID (public or own)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is authenticated and viewing their own profile
    const token = req.headers.authorization?.split(' ')[1];
    let isOwnProfile = false;
    let requestingUserId: string | null = null;

    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET);
        requestingUserId = decoded.userId;
        isOwnProfile = requestingUserId === userId;
      } catch (err) {
        // Invalid token, treat as public request
      }
    }

    // If viewing own profile, return full data (excluding sensitive fields)
    if (isOwnProfile) {
      const user = await User.findById(userId).select('-passwordHash');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ 
        profile: user,
        isOwnProfile: true 
      });
    }

    // Otherwise return public profile data only
    const user = await User.findById(userId)
      .select('-passwordHash -email -phone -lastActive');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return public profile data
    const publicProfile = {
      id: user._id,
      name: user.name,
      bio: user.bio,
      profilePhoto: user.profilePhoto,
      location: user.location,
      role: user.role,
      socialLinks: user.socialLinks,
      organizerProfile: user.organizerProfile,
      isVerified: user.isVerified,
      createdAt: user.createdAt
    };

    res.json({ 
      profile: publicProfile,
      isOwnProfile: false 
    });
  } catch (error: any) {
    logger.error('Error fetching profile', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/me', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'Invalid profile data', 
        details: parsed.error.flatten() 
      });
    }

    const updateData = parsed.data;

    // Convert date string to Date object if provided
    if (updateData.dateOfBirth) {
      (updateData as any).dateOfBirth = new Date(updateData.dateOfBirth);
    }

    // Update last active timestamp
    (updateData as any).lastActive = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User profile updated', { userId, updatedFields: Object.keys(updateData) });

    res.json({ 
      message: 'Profile updated successfully',
      user: updatedUser 
    });
  } catch (error: any) {
    logger.error('Error updating profile', { error: error.message });
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload or delete profile photo
router.post('/photo', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const { photo } = req.body;

    // Handle photo deletion (when photo is empty string)
    const photoValue = photo === '' ? null : photo;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: photoValue },
      { new: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (photo === '') {
      logger.info('Profile photo deleted', { userId });
      res.json({ 
        message: 'Profile photo deleted successfully',
        profilePhoto: ''
      });
    } else {
      logger.info('Profile photo updated', { userId });
      res.json({ 
        message: 'Profile photo updated successfully',
        profilePhoto: updatedUser.profilePhoto
      });
    }
  } catch (error: any) {
    logger.error('Error updating profile photo', { error: error.message });
    res.status(500).json({ error: 'Failed to update profile photo' });
  }
});

// Get profile statistics
router.get('/me/stats', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    // Get user with basic info
    const user = await User.findById(userId).select('role createdAt organizerProfile');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let stats: any = {
      memberSince: user.createdAt,
      profileCompleteness: 0
    };

    // Calculate profile completeness
    const userFull = await User.findById(userId).select('-passwordHash');
    if (userFull) {
      let completenessScore = 0;
      const fields = ['name', 'bio', 'location', 'phone', 'profilePhoto'];
      fields.forEach(field => {
        if ((userFull as any)[field]) completenessScore += 20;
      });
      stats.profileCompleteness = completenessScore;
    }

    if (user.role === 'organizer') {
      // Import Trip model here to avoid circular dependency
      const { Trip } = await import('../models/Trip');
      
      const [tripsOrganized, totalParticipants] = await Promise.all([
        Trip.countDocuments({ organizerId: userId }),
        Trip.aggregate([
          { $match: { organizerId: userId } },
          { $project: { participantCount: { $size: '$participants' } } },
          { $group: { _id: null, total: { $sum: '$participantCount' } } }
        ])
      ]);

      stats.tripsOrganized = tripsOrganized;
      stats.totalParticipants = totalParticipants[0]?.total || 0;
      stats.organizerRating = 4.5; // This would come from reviews in a real system
    } else {
      // For travelers
      const { Trip } = await import('../models/Trip');
      
      const tripsJoined = await Trip.countDocuments({ participants: userId });
      stats.tripsJoined = tripsJoined;
    }

    res.json({ stats });
  } catch (error: any) {
    logger.error('Error fetching profile stats', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch profile statistics' });
  }
});

// Generate shareable profile link
router.post('/me/share', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    // Generate a shareable link for the profile
    const shareableLink = `${req.protocol}://${req.get('host')}/profile/${userId}`;
    
    logger.info('Shareable profile link generated', { userId });

    res.json({ 
      message: 'Shareable link generated',
      shareableLink,
      socialShareText: `Check out my Trek Tribe adventure profile!`
    });
  } catch (error: any) {
    logger.error('Error generating shareable link', { error: error.message });
    res.status(500).json({ error: 'Failed to generate shareable link' });
  }
});

export default router;
