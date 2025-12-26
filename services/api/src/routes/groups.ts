import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(10).max(1000),
  category: z.enum(['trekking', 'camping', 'wildlife', 'adventure', 'photography', 'cycling', 'other']),
  coverImage: z.string().url().optional(),
  tags: z.array(z.string().max(30)).optional(),
  rules: z.string().max(2000).optional(),
  location: z.string().max(100).optional(),
  isPublic: z.boolean().optional()
});

/**
 * POST /api/groups
 * Create a new group
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    
    const parsed = createGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid group data',
        details: parsed.error.flatten()
      });
    }

    const group = new Group({
      ...parsed.data,
      creatorId: userId,
      admins: [userId],
      members: [userId],
      memberCount: 1
    });

    await group.save();

    // Award reputation points for creating a group
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 50 }
    });

    logger.info('Group created', { groupId: group._id, userId });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      group
    });
  } catch (error: any) {
    logger.error('Error creating group', { error: error.message });
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * GET /api/groups
 * Get all groups with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const skip = (page - 1) * limit;
    const category = req.query.category as string;
    const search = req.query.search as string;

    const filter: any = { isPublic: true };
    if (category) filter.category = category;
    if (search) {
      filter.$text = { $search: search };
    }

    const groups = await Group.find(filter)
      .populate('creatorId', 'name profilePhoto')
      .sort({ memberCount: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalGroups = await Group.countDocuments(filter);

    res.json({
      success: true,
      groups,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalGroups / limit),
        totalGroups,
        hasNext: page < Math.ceil(totalGroups / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching groups', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

/**
 * GET /api/groups/:groupId
 * Get a specific group
 */
router.get('/:groupId', async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate('creatorId', 'name profilePhoto')
      .populate('admins', 'name profilePhoto')
      .populate('members', 'name profilePhoto location');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    res.json({ success: true, group });
  } catch (error: any) {
    logger.error('Error fetching group', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

/**
 * POST /api/groups/:groupId/join
 * Join a group
 */
router.post('/:groupId/join', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.members.includes(userId)) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    group.members.push(userId);
    group.memberCount = group.members.length;
    await group.save();

    // Award reputation points for joining a group
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 10 }
    });

    logger.info('User joined group', { groupId, userId });

    res.json({
      success: true,
      message: 'Joined group successfully',
      memberCount: group.memberCount
    });
  } catch (error: any) {
    logger.error('Error joining group', { error: error.message });
    res.status(500).json({ error: 'Failed to join group' });
  }
});

/**
 * POST /api/groups/:groupId/leave
 * Leave a group
 */
router.post('/:groupId/leave', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creatorId.toString() === userId) {
      return res.status(400).json({ error: 'Group creator cannot leave the group' });
    }

    if (!group.members.includes(userId)) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }

    group.members = group.members.filter(id => id.toString() !== userId);
    group.admins = group.admins.filter(id => id.toString() !== userId);
    group.memberCount = group.members.length;
    await group.save();

    logger.info('User left group', { groupId, userId });

    res.json({
      success: true,
      message: 'Left group successfully',
      memberCount: group.memberCount
    });
  } catch (error: any) {
    logger.error('Error leaving group', { error: error.message });
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

/**
 * DELETE /api/groups/:groupId
 * Delete a group (creator only)
 */
router.delete('/:groupId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).auth.userId;
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creatorId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the group creator can delete this group' });
    }

    await Group.findByIdAndDelete(groupId);

    logger.info('Group deleted', { groupId, userId });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting group', { error: error.message });
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

export default router;
