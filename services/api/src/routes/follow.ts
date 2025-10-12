import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { Follow } from '../models/Follow';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Follow a user
router.post('/:userId', authenticateJwt, async (req, res) => {
  try {
    const followerId = (req as any).auth.userId;
    const followingId = req.params.userId;

    // Can't follow yourself
    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    // Check if target user exists and is an organizer
    const targetUser = await User.findById(followingId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role !== 'organizer') {
      return res.status(400).json({ error: 'You can only follow trip organizers' });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({
      followerId,
      followingId
    });

    if (existingFollow) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Create follow relationship
    const follow = new Follow({
      followerId,
      followingId
    });

    await follow.save();

    // Update follower/following counts
    await User.findByIdAndUpdate(followerId, {
      $inc: { 'socialStats.followingCount': 1 }
    });

    await User.findByIdAndUpdate(followingId, {
      $inc: { 'socialStats.followersCount': 1 }
    });

    logger.info('User followed', { followerId, followingId });

    res.json({ message: 'Successfully followed user' });
  } catch (error: any) {
    logger.error('Error following user', { error: error.message });
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.delete('/:userId', authenticateJwt, async (req, res) => {
  try {
    const followerId = (req as any).auth.userId;
    const followingId = req.params.userId;

    const follow = await Follow.findOneAndDelete({
      followerId,
      followingId
    });

    if (!follow) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    // Update follower/following counts
    await User.findByIdAndUpdate(followerId, {
      $inc: { 'socialStats.followingCount': -1 }
    });

    await User.findByIdAndUpdate(followingId, {
      $inc: { 'socialStats.followersCount': -1 }
    });

    logger.info('User unfollowed', { followerId, followingId });

    res.json({ message: 'Successfully unfollowed user' });
  } catch (error: any) {
    logger.error('Error unfollowing user', { error: error.message });
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Check if following a user
router.get('/:userId/status', authenticateJwt, async (req, res) => {
  try {
    const followerId = (req as any).auth.userId;
    const followingId = req.params.userId;

    const isFollowing = await Follow.findOne({
      followerId,
      followingId
    });

    res.json({ isFollowing: !!isFollowing });
  } catch (error: any) {
    logger.error('Error checking follow status', { error: error.message });
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// Get followers list
router.get('/:userId/followers', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const followers = await Follow.find({ followingId: userId })
      .populate('followerId', 'name profilePhoto role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalFollowers = await Follow.countDocuments({ followingId: userId });

    res.json({
      followers: followers.map(f => f.followerId),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowers / limit),
        totalFollowers,
        hasNext: page < Math.ceil(totalFollowers / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching followers', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get following list
router.get('/:userId/following', async (req, res) => {
  try {
    const userId = req.params.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const following = await Follow.find({ followerId: userId })
      .populate('followingId', 'name profilePhoto role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalFollowing = await Follow.countDocuments({ followerId: userId });

    res.json({
      following: following.map(f => f.followingId),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalFollowing / limit),
        totalFollowing,
        hasNext: page < Math.ceil(totalFollowing / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching following', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

export default router;
