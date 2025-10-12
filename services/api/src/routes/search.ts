import express from 'express';
import { User } from '../models/User';
import { authenticateJwt } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = express.Router();

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

    const profiles = await User.find(searchCriteria)
      .select('name email profilePhoto role location bio socialStats isVerified')
      .limit(searchLimit)
      .sort({ 'socialStats.followersCount': -1, name: 1 });

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

    const searchCriteria: any = {};
    
    // Add role filter if specified
    if (role && ['traveler', 'organizer', 'admin', 'agent'].includes(role.toString())) {
      searchCriteria.role = role.toString();
    }

    const suggestions = await User.find(searchCriteria)
      .select('name email profilePhoto role location bio socialStats isVerified')
      .sort({ 
        'socialStats.followersCount': -1, 
        'socialStats.postsCount': -1,
        'createdAt': -1 
      })
      .limit(searchLimit);

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
