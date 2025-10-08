import express from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @route GET /api/public/:uniqueUrl
 * @description Get public user profile by unique URL
 * @access Public
 */
router.get('/:uniqueUrl', async (req, res) => {
  try {
    const { uniqueUrl } = req.params;

    // Find user by unique URL
    const user = await User.findOne({ uniqueUrl })
      .select('-passwordHash -resetPasswordToken -emergencyContact -verificationDocuments')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    // Check privacy settings
    if (user.privacySettings?.profileVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This profile is private'
      });
    }

    // Filter information based on privacy settings
    let profileData: any = { ...user };
    const privacySettings = user.privacySettings || {
      showEmail: false,
      showPhone: false,
      showLocation: true
    };

    if (!privacySettings.showEmail) {
      delete profileData.email;
    }
    if (!privacySettings.showPhone) {
      delete profileData.phone;
    }
    if (!privacySettings.showLocation) {
      delete profileData.location;
    }

    // Get user's organized trips (if organizer)
    let organizedTrips: any[] = [];
    if (user.role === 'organizer') {
      organizedTrips = await Trip.find({ 
        organizerId: user._id,
        status: 'active'
      })
      .select('title description destination price startDate endDate images coverImage categories difficulty capacity participants')
      .sort({ startDate: 1 })
      .limit(20)
      .lean();
    }

    // Get user's participation in trips (for travelers)
    let participatedTrips: any[] = [];
    if (user.role === 'traveler') {
      participatedTrips = await Trip.find({
        participants: user._id,
        status: { $in: ['active', 'completed'] }
      })
      .select('title destination startDate endDate images coverImage organizerId')
      .populate('organizerId', 'name uniqueUrl profilePhoto')
      .sort({ startDate: -1 })
      .limit(10)
      .lean();
    }

    // Calculate profile statistics
    const stats = {
      tripsOrganized: organizedTrips.length,
      tripsParticipated: participatedTrips.length,
      totalParticipants: organizedTrips.reduce((sum, trip) => sum + (trip.participants?.length || 0), 0),
      averageRating: user.travelStats?.averageRating || 0,
      reviewCount: user.travelStats?.reviewCount || 0,
      experience: user.organizerProfile?.yearsOfExperience || 0,
      badges: user.travelStats?.badges || []
    };

    res.json({
      success: true,
      data: {
        user: profileData,
        organizedTrips,
        participatedTrips,
        stats,
        isOrganizer: user.role === 'organizer'
      }
    });

  } catch (error: any) {
    logger.error('Error fetching public profile', { 
      error: error.message, 
      uniqueUrl: req.params.uniqueUrl 
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

/**
 * @route GET /api/public/search/organizers
 * @description Search organizers by various criteria
 * @access Public
 */
router.get('/search/organizers', async (req, res) => {
  try {
    const { 
      q,        // General search query
      location,
      specialty,
      minRating,
      minExperience,
      language,
      page = 1,
      limit = 12
    } = req.query;

    const searchQuery: any = {
      role: 'organizer',
      'privacySettings.profileVisibility': { $ne: 'private' }
    };

    // Build search filters
    if (q) {
      const searchRegex = new RegExp(q as string, 'i');
      searchQuery.$or = [
        { name: searchRegex },
        { 'organizerProfile.bio': searchRegex },
        { bio: searchRegex },
        { 'organizerProfile.businessInfo.companyName': searchRegex }
      ];
    }

    if (location) {
      const locationRegex = new RegExp(location as string, 'i');
      searchQuery.location = locationRegex;
    }

    if (specialty) {
      searchQuery['organizerProfile.specialties'] = { 
        $in: [new RegExp(specialty as string, 'i')] 
      };
    }

    if (minRating) {
      searchQuery['travelStats.averageRating'] = { $gte: parseFloat(minRating as string) };
    }

    if (minExperience) {
      searchQuery['organizerProfile.yearsOfExperience'] = { $gte: parseInt(minExperience as string) };
    }

    if (language) {
      searchQuery['organizerProfile.languages'] = { 
        $in: [new RegExp(language as string, 'i')] 
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Execute search
    const organizers = await User.find(searchQuery)
      .select(`
        name bio location profilePhoto coverPhoto uniqueUrl
        organizerProfile.bio organizerProfile.specialties organizerProfile.languages 
        organizerProfile.yearsOfExperience organizerProfile.totalTripsOrganized
        organizerProfile.businessInfo.companyName
        travelStats.averageRating travelStats.reviewCount
        socialLinks createdAt
      `)
      .sort({ 
        'travelStats.averageRating': -1,
        'organizerProfile.totalTripsOrganized': -1 
      })
      .skip(skip)
      .limit(parseInt(limit as string))
      .lean();

    // Get trip counts for each organizer
    const organizersWithStats = await Promise.all(
      organizers.map(async (organizer) => {
        const activeTrips = await Trip.countDocuments({
          organizerId: organizer._id,
          status: 'active'
        });

        const upcomingTrips = await Trip.countDocuments({
          organizerId: organizer._id,
          status: 'active',
          startDate: { $gte: new Date() }
        });

        return {
          ...organizer,
          stats: {
            activeTrips,
            upcomingTrips,
            totalOrganized: organizer.organizerProfile?.totalTripsOrganized || 0,
            rating: organizer.travelStats?.averageRating || 0,
            reviews: organizer.travelStats?.reviewCount || 0,
            experience: organizer.organizerProfile?.yearsOfExperience || 0
          }
        };
      })
    );

    // Get total count for pagination
    const totalCount = await User.countDocuments(searchQuery);
    const totalPages = Math.ceil(totalCount / parseInt(limit as string));

    res.json({
      success: true,
      data: {
        organizers: organizersWithStats,
        pagination: {
          currentPage: parseInt(page as string),
          totalPages,
          totalCount,
          hasNext: parseInt(page as string) < totalPages,
          hasPrev: parseInt(page as string) > 1
        },
        filters: {
          q, location, specialty, minRating, minExperience, language
        }
      }
    });

  } catch (error: any) {
    logger.error('Error searching organizers', { error: error.message, query: req.query });
    
    res.status(500).json({
      success: false,
      message: 'Failed to search organizers'
    });
  }
});

/**
 * @route GET /api/public/featured/organizers
 * @description Get featured organizers for homepage
 * @access Public
 */
router.get('/featured/organizers', async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const featuredOrganizers = await User.find({
      role: 'organizer',
      'privacySettings.profileVisibility': { $ne: 'private' },
      'travelStats.averageRating': { $gte: 4.0 },
      'organizerProfile.totalTripsOrganized': { $gte: 5 }
    })
    .select(`
      name bio location profilePhoto uniqueUrl
      organizerProfile.specialties organizerProfile.yearsOfExperience 
      organizerProfile.totalTripsOrganized
      travelStats.averageRating travelStats.reviewCount
    `)
    .sort({ 
      'travelStats.averageRating': -1,
      'travelStats.reviewCount': -1,
      'organizerProfile.totalTripsOrganized': -1 
    })
    .limit(parseInt(limit as string))
    .lean();

    res.json({
      success: true,
      data: {
        organizers: featuredOrganizers
      }
    });

  } catch (error: any) {
    logger.error('Error fetching featured organizers', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured organizers'
    });
  }
});

/**
 * @route POST /api/public/generate-url/:userId
 * @description Generate unique URL for any user
 * @access Private (requires authentication)
 */
router.post('/generate-url/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { baseName } = req.body;

    if (!baseName || baseName.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Base name must be at least 3 characters long'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
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
      const existing = await User.findOne({ uniqueUrl: suggestion });
      if (!existing) {
        break;
      }
      suggestion = `${sanitizedBase}-${counter}`;
      counter++;
      
      if (counter > 999) {
        return res.status(400).json({
          success: false,
          message: 'Unable to generate unique URL'
        });
      }
    }

    // Update user with new unique URL
    await User.findByIdAndUpdate(userId, { uniqueUrl: suggestion });

    res.json({
      success: true,
      data: { 
        suggestion,
        fullUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/u/${suggestion}`
      }
    });

  } catch (error: any) {
    logger.error('Error generating unique URL', { error: error.message });
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate unique URL'
    });
  }
});

export default router;