import express from 'express';
import { authenticateJwt } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { UserPrisma as User } from '../models/userPrismaAdapter';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Follow rows live in Postgres (D10/D11 wave 1). User still lives in Mongo, so
 * follower_id / following_id are ObjectId strings with no foreign key behind them
 * until User migrates in wave 9.
 *
 * Two consequences are handled explicitly below:
 *
 *  - No `populate`. The lists query Postgres for ids, then Mongo for the users,
 *    and re-impose the Postgres ordering, because $in does not preserve order.
 *
 *  - No transaction spans the two databases. socialStats counters stay on the
 *    Mongo User because search.ts sorts on them with an index behind it
 *    (User.ts:495), which a Postgres-side count cannot serve. Postgres is written
 *    first, so a mid-way failure leaves a real follow whose counter is low - which
 *    a recount can repair - rather than a counter with no follow behind it.
 */

/** Fetch users for a set of ids and return them in the order the ids were given. */
async function usersInIdOrder(ids: string[]) {
  if (ids.length === 0) return [];
  const users = await User.find({ _id: { $in: ids } })
    .select('name profilePhoto role')
    .lean();
  const byId = new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
  return ids.map(id => byId.get(id)).filter(Boolean);
}

// Follow a user
router.post('/:userId', authenticateJwt, async (req, res) => {
  try {
    const followerId = (req as any).auth.userId;
    const followingId = req.params.userId;

    // Fast, friendly rejection. The database also enforces this with a CHECK
    // constraint, so it holds even if some other code path writes a follow.
    if (followerId === followingId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const targetUser = await User.findById(followingId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role !== 'organizer') {
      return res.status(400).json({ error: 'You can only follow trip organizers' });
    }

    // No check-then-insert. Two concurrent requests both pass a pre-check; the
    // unique constraint is what actually decides, so let it decide.
    try {
      await prisma.follow.create({ data: { followerId, followingId } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return res.status(400).json({ error: 'Already following this user' });
      }
      throw err;
    }

    await User.findByIdAndUpdate(followerId, { $inc: { 'socialStats.followingCount': 1 } });
    await User.findByIdAndUpdate(followingId, { $inc: { 'socialStats.followersCount': 1 } });

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

    const deleted = await prisma.follow.deleteMany({ where: { followerId, followingId } });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Not following this user' });
    }

    await User.findByIdAndUpdate(followerId, { $inc: { 'socialStats.followingCount': -1 } });
    await User.findByIdAndUpdate(followingId, { $inc: { 'socialStats.followersCount': -1 } });

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

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    });

    res.json({ isFollowing: !!existing });
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

    const [rows, totalFollowers] = await Promise.all([
      prisma.follow.findMany({
        where: { followingId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { followerId: true }
      }),
      prisma.follow.count({ where: { followingId: userId } })
    ]);

    const followers = await usersInIdOrder(rows.map(r => r.followerId));

    res.json({
      followers,
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

    const [rows, totalFollowing] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: { followingId: true }
      }),
      prisma.follow.count({ where: { followerId: userId } })
    ]);

    const following = await usersInIdOrder(rows.map(r => r.followingId));

    res.json({
      following,
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
