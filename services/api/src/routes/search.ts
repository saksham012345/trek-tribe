import express from 'express';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { authenticateJwt } from '../middleware/auth';
import { logger } from '../utils/logger';
import { cacheMiddleware } from '../utils/cache';

const router = express.Router();

// Search trips
router.get('/trips', cacheMiddleware(300), async (req, res) => {
  try {
    const { query, q, limit = 20, category, difficulty, minPrice, maxPrice } = req.query;
    
    const searchQuery = (query || q || '').toString().trim();
    
    if (!searchQuery || searchQuery.length < 2) {
      return res.json({ trips: [], totalResults: 0, query: searchQuery });
    }

    const searchLimit = Math.min(parseInt(limit.toString()) || 20, 50);
    
    // Build search criteria
    const searchCriteria: any = {
      status: 'active', // Only show active trips
      $or: [
        { title: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } },
        { destination: { $regex: searchQuery, $options: 'i' } }
      ]
    };

    // Add filters
    if (category) {
      searchCriteria.categories = category.toString();
    }
    
    if (difficulty) {
      searchCriteria.difficulty = difficulty.toString();
    }
    
    if (minPrice || maxPrice) {
      searchCriteria.price = {};
      if (minPrice) searchCriteria.price.$gte = parseInt(minPrice.toString());
      if (maxPrice) searchCriteria.price.$lte = parseInt(maxPrice.toString());
    }

    const trips = await Trip.find(searchCriteria)
      .select('title description destination price startDate endDate coverImage difficulty categories capacity participants status')
      .populate({
        path: 'organizerId',
        select: 'name profilePhoto',
        options: { lean: true }
      })
      .limit(searchLimit)
      .sort({ startDate: 1, createdAt: -1 })
      .lean();

    const formattedTrips = trips.map(trip => ({
      ...trip,
      availableSpots: trip.capacity - (trip.participants?.length || 0)
    }));

    logger.info('Trip search performed', { 
      query: searchQuery, 
      resultsCount: formattedTrips.length,
      filters: { category, difficulty, minPrice, maxPrice }
    });

    res.json({ 
      trips: formattedTrips,
      query: searchQuery,
      totalResults: formattedTrips.length
    });

  } catch (error: any) {
    logger.error('Error searching trips', { error: error.message, query: req.query.q || req.query.query });
    res.status(500).json({ error: 'Failed to search trips' });
  }
});

// Search profiles
router.get('/profiles', async (req, res) => {
  try {
    const { q: query, limit = 10, role } = req.query;
    
    if (!query || query.toString().trim().length < 2) {
      return res.json({ profiles: [] });
    }

    const searchQuery = query.toString().trim();
    const searchLimit = Math.min(parseInt(limit.toString()) || 10, 50);
    
    // Build search criteria
    const searchCriteria: any = {
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { location: { $regex: searchQuery, $options: 'i' } },
        { bio: { $regex: searchQuery, $options: 'i' } }
      ]
    };

    // Add role filter if specified
    if (role && ['traveler', 'organizer', 'admin', 'agent'].includes(role.toString())) {
      searchCriteria.role = role.toString();
    }

    // If no role specified, prioritize organizers
    if (!role) {
      searchCriteria.role = 'organizer';
    }

    const profiles = await User.find(searchCriteria)
      .select('name email profilePhoto role location bio socialStats isVerified')
      .limit(searchLimit)
      .sort({ 'socialStats.followersCount': -1, 'socialStats.postsCount': -1, name: 1 })
      .lean();

    const formattedProfiles = profiles.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePhoto: user.profilePhoto,
      role: user.role,
      location: user.location,
      bio: user.bio,
      socialStats: user.socialStats || { followersCount: 0, followingCount: 0, postsCount: 0 },
      isVerified: user.isVerified || false
    }));

    logger.info('Profile search performed', { 
      query: searchQuery, 
      resultsCount: formattedProfiles.length,
      role: role || 'all'
    });

    res.json({ 
      profiles: formattedProfiles,
      query: searchQuery,
      totalResults: formattedProfiles.length
    });

  } catch (error: any) {
    logger.error('Error searching profiles', { error: error.message, query: req.query.q });
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

// Get profile suggestions (popular profiles)
router.get('/suggestions', async (req, res) => {
  try {
    const { limit = 8, role } = req.query;
    const searchLimit = Math.min(parseInt(limit.toString()) || 8, 20);

    const searchCriteria: any = {
      role: 'organizer' // Only show organizers in suggestions
    };

    const suggestions = await User.find(searchCriteria)
      .select('name email profilePhoto role location bio socialStats isVerified')
      .sort({ 
        'socialStats.followersCount': -1, 
        'socialStats.postsCount': -1,
        'createdAt': -1 
      })
      .limit(searchLimit)
      .lean();

    const formattedSuggestions = suggestions.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePhoto: user.profilePhoto,
      role: user.role,
      location: user.location,
      bio: user.bio,
      socialStats: user.socialStats || { followersCount: 0, followingCount: 0, postsCount: 0 },
      isVerified: user.isVerified || false
    }));

    res.json({ 
      suggestions: formattedSuggestions,
      totalResults: formattedSuggestions.length
    });

  } catch (error: any) {
    logger.error('Error fetching profile suggestions', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

// Search posts
router.get('/posts', async (req, res) => {
  try {
    const { q: query, limit = 10, type } = req.query;
    
    if (!query || query.toString().trim().length < 2) {
      return res.json({ posts: [] });
    }

    const searchQuery = query.toString().trim();
    const searchLimit = Math.min(parseInt(limit.toString()) || 10, 50);

    // This would require importing the Post model
    // For now, return empty results
    res.json({ 
      posts: [],
      query: searchQuery,
      totalResults: 0,
      message: 'Post search will be implemented when Post model is integrated'
    });

  } catch (error: any) {
    logger.error('Error searching posts', { error: error.message, query: req.query.q });
    res.status(500).json({ error: 'Failed to search posts' });
  }
});

export default router;
