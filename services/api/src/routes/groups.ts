import express, { Request, Response } from 'express';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { withMongoId, withMongoIds, asPopulated } from '../lib/apiShape';
import { UserPrisma as User } from '../models/userPrismaAdapter';
import { logger } from '../utils/logger';

/**
 * Load the Mongo users behind a set of ids, keyed for lookup. The populate()
 * calls this replaces cannot work across two databases.
 */
async function loadUsers(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } })
    .select('name profilePhoto location')
    .lean();
  return new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
}

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

    // The creator's membership is created with the group, so a group never
    // exists for a moment with nobody in it. admins[] and members[] were two
    // arrays with the creator in both; it is one row with role 'admin' now.
    const group = await prisma.group.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        category: parsed.data.category,
        coverImage: parsed.data.coverImage,
        isPublic: parsed.data.isPublic ?? true,
        tags: parsed.data.tags ?? [],
        rules: parsed.data.rules,
        location: parsed.data.location,
        creatorId: userId,
        members: { create: [{ userId, role: 'admin' }] }
      }
    });

    // Award reputation points for creating a group
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 50 }
    });

    logger.info('Group created', { groupId: group.id, userId });

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
      filter.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    // memberCount is no longer a column; the sort orders by the relation count,
    // so it cannot disagree with the members it is counting.
    const [groups, totalGroups] = await Promise.all([
      prisma.group.findMany({
        where: filter,
        orderBy: [{ members: { _count: 'desc' } }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: { _count: { select: { members: true } } }
      }),
      prisma.group.count({ where: filter })
    ]);

    const creators = await loadUsers(groups.map(g => g.creatorId));

    res.json({
      success: true,
      groups: groups.map(g => ({
        ...withMongoId(g),
        creatorId: asPopulated(creators.get(g.creatorId)),
        memberCount: g._count.members
      })),
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
    const group = await prisma.group.findUnique({
      where: { id: req.params.groupId },
      include: { members: true }
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // The three populate() calls become one lookup - User is still in Mongo -
    // and admins/members are rebuilt from the membership rows so the response
    // keeps the shape the page reads.
    const users = await loadUsers([group.creatorId, ...group.members.map(m => m.userId)]);
    const asUser = (id: string) => asPopulated(users.get(id));

    res.json({
      success: true,
      group: {
        ...withMongoId(group),
        creatorId: asUser(group.creatorId),
        admins: group.members.filter(m => m.role === 'admin').map(m => asUser(m.userId)),
        members: group.members.map(m => asUser(m.userId)),
        memberCount: group.members.length
      }
    });
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

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // One membership per user is a constraint, so the insert decides rather
    // than a pre-check two concurrent joins could both pass.
    try {
      await prisma.groupMember.create({ data: { groupId, userId } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(400).json({ error: 'Already a member of this group' });
      }
      throw err;
    }

    const memberCount = await prisma.groupMember.count({ where: { groupId } });

    // Award reputation points for joining a group
    await User.findByIdAndUpdate(userId, {
      $inc: { 'reputation.points': 10 }
    });

    logger.info('User joined group', { groupId, userId });

    res.json({
      success: true,
      message: 'Joined group successfully',
      memberCount
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

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creatorId === userId) {
      return res.status(400).json({ error: 'Group creator cannot leave the group' });
    }

    // One row covers both lists now, so leaving removes the membership and the
    // admin role together - the old code had to remember to filter both arrays.
    const removed = await prisma.groupMember.deleteMany({ where: { groupId, userId } });
    if (removed.count === 0) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }

    const memberCount = await prisma.groupMember.count({ where: { groupId } });

    logger.info('User left group', { groupId, userId });

    res.json({
      success: true,
      message: 'Left group successfully',
      memberCount
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

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.creatorId !== userId) {
      return res.status(403).json({ error: 'Only the group creator can delete this group' });
    }

    // Memberships go with it - the foreign key cascades - so there is no second
    // delete to forget.
    await prisma.group.delete({ where: { id: groupId } });

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
