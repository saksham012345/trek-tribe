import express from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { withMongoId, asPopulated } from '../lib/apiShape';

/**
 * Posts and Comments live in Postgres (D10/D11, wave 2). They moved together
 * because Comment.postId pointed at Post and Post carried a comments array
 * pointing back, so neither could be split from the other.
 *
 * What changed, and why:
 *
 *  1. Likes were `ObjectId[]` on the document. As an array, "one like per user"
 *     could only ever be a check in application code. They are now rows in
 *     post_likes / comment_likes with a unique constraint, so a double like is
 *     refused by the database. The toggle handles P2002 instead of pre-checking.
 *
 *  2. Post.comments is gone. Comment.postId already said the same thing, and
 *     keeping both invites the two to disagree. Counts are derived.
 *
 *  3. Deleting a post no longer deletes comments by hand - the foreign keys
 *     cascade.
 *
 *  4. The follow feed used to read `user.following`, a Mongo array that nothing
 *     in this codebase ever writes to. That endpoint therefore returned "you are
 *     not following anyone" to everyone, always. It now reads the follows table
 *     that /api/follow actually writes, so the feed starts returning posts.
 *     This is a behaviour change, and a deliberate one.
 *
 *  socialStats.postsCount stays on the Mongo User for the same reason the
 *  follower counters did: search.ts sorts on it with an index behind it, and a
 *  Postgres-side count cannot serve that sort.
 */

const router = express.Router();

const createPostSchema = z.object({
  type: z.enum(['trip_memory', 'general_post', 'link_share', 'experience']),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  images: z.array(z.string().url()).optional(),
  links: z.array(z.object({
    title: z.string().min(1).max(100),
    url: z.string().url(),
    description: z.string().max(200).optional()
  })).optional(),
  tripData: z.object({
    destination: z.string().max(100),
    startDate: z.string().transform(str => new Date(str)),
    endDate: z.string().transform(str => new Date(str)),
    participants: z.number().min(1).optional(),
    highlights: z.array(z.string().max(100)).optional(),
    rating: z.number().min(1).max(5).optional()
  }).optional(),
  tags: z.array(z.string().max(30)).optional(),
  isPublic: z.boolean().optional()
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
  parentCommentId: z.string().optional()
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Load the Mongo users behind a set of ids, keyed for lookup. */
async function authorsById(ids: string[], fields = 'name profilePhoto role') {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Map<string, any>();
  const users = await User.find({ _id: { $in: unique } }).select(fields).lean();
  return new Map(users.map((u: any) => [u._id.toString(), u]));
}

/**
 * Shape a post the way the API used to answer, because PostCard.tsx is the
 * contract and it was written against Mongoose. It reads post._id, calls
 * post.likes.length, iterates post.likes looking for like._id, and reads
 * post.authorId as a populated object. A response carrying id / likesCount /
 * author instead does not merely look different - post.likes.length throws
 * during render, and the component never mounts.
 *
 * So likes stays an array, of { _id } for the users who liked. That is exactly
 * what the "have I liked this" check needs and nothing more.
 */
function shapePost(post: any, author: any, likerIds: string[] = []) {
  const { likes, comments, _count, ...rest } = post;
  return {
    ...withMongoId(rest),
    authorId: asPopulated(author),
    author,
    likes: likerIds.map(id => ({ _id: id, id })),
    comments: Array.isArray(comments) ? comments.map(withMongoId) : [],
    likesCount: _count?.likes ?? likerIds.length,
    commentsCount: _count?.comments ?? (Array.isArray(comments) ? comments.length : 0)
  };
}

/** Who liked each of these posts, so a list can answer "have I liked it". */
async function likersByPost(postIds: string[]) {
  if (postIds.length === 0) return new Map<string, string[]>();
  const rows = await prisma.postLike.findMany({
    where: { postId: { in: postIds } },
    select: { postId: true, userId: true }
  });
  const byPost = new Map<string, string[]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push(r.userId);
    byPost.set(r.postId, list);
  }
  return byPost;
}

// Create a new post
router.post('/', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth?.userId || (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid post data',
        details: parsed.error.flatten()
      });
    }

    const { type, title, content, images, links, tripData, tags, isPublic } = parsed.data;

    const post = await prisma.post.create({
      data: {
        authorId: userId,
        type,
        title,
        content,
        images: images ?? [],
        links: (links ?? []) as any,
        // Dates do not survive a JSON column as Date objects.
        tripData: tripData
          ? ({
              ...tripData,
              startDate: tripData.startDate.toISOString(),
              endDate: tripData.endDate.toISOString()
            } as any)
          : undefined,
        tags: (tags ?? []).map(t => t.toLowerCase().trim()),
        isPublic: isPublic ?? true
      }
    });

    await User.findByIdAndUpdate(userId, { $inc: { 'socialStats.postsCount': 1 } });

    const authors = await authorsById([userId]);

    logger.info('Post created', { postId: post.id, authorId: userId });

    res.status(201).json({
      message: 'Post created successfully',
      post: shapePost(post, authors.get(userId) ?? null, [])
    });
  } catch (error: any) {
    logger.error('Error creating post', { error: error.message });
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// Get posts (with pagination and filtering)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type as string;
    const authorId = req.query.authorId as string;

    const where: any = { isPublic: true };
    if (type) where.type = type;
    if (authorId) where.authorId = authorId;

    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { likes: true, comments: true } } }
      }),
      prisma.post.count({ where })
    ]);

    const [authors, likers] = await Promise.all([
      authorsById(posts.map(p => p.authorId)),
      likersByPost(posts.map(p => p.id))
    ]);

    res.json({
      posts: posts.map(p => shapePost(p, authors.get(p.authorId) ?? null, likers.get(p.id) ?? [])),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasNext: page < Math.ceil(totalPosts / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching posts', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// Get posts from followed users (Follow Feed)
// Grouped with the other fixed paths before the parameterised ones. Express
// matches /:postId against a single segment only, so a two-segment path could
// not have collided with it anyway - this is ordering for readability, not a fix.
router.get('/feed/following', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    // Reads the follows table, not user.following. See the note at the top.
    const follows = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });
    const followingIds = follows.map(f => f.followingId);

    if (followingIds.length === 0) {
      return res.json({
        posts: [],
        pagination: { currentPage: page, totalPages: 0, totalPosts: 0, hasNext: false, hasPrev: false },
        message: 'You are not following anyone yet'
      });
    }

    const where = { authorId: { in: followingIds }, isPublic: true };

    const [posts, totalPosts] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { _count: { select: { likes: true, comments: true } } }
      }),
      prisma.post.count({ where })
    ]);

    const [authors, likers] = await Promise.all([
      authorsById(posts.map(p => p.authorId)),
      likersByPost(posts.map(p => p.id))
    ]);

    logger.info('Follow feed fetched', { userId, postsCount: posts.length });

    res.json({
      posts: posts.map(p => shapePost(p, authors.get(p.authorId) ?? null, likers.get(p.id) ?? [])),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPosts / limit),
        totalPosts,
        hasNext: page < Math.ceil(totalPosts / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching follow feed', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch follow feed' });
  }
});

// Get social engagement metrics
// Same grouping.
router.get('/metrics/engagement', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const days = parseInt(req.query.days as string) || 30;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userPosts = await prisma.post.findMany({
      where: { authorId: userId, createdAt: { gte: startDate } },
      include: { _count: { select: { likes: true, comments: true } } }
    });

    const totalPosts = userPosts.length;
    const totalLikes = userPosts.reduce((sum, p) => sum + p._count.likes, 0);
    const totalComments = userPosts.reduce((sum, p) => sum + p._count.comments, 0);

    const engagementByType: Record<string, { posts: number; likes: number; comments: number }> = {};
    for (const post of userPosts) {
      if (!engagementByType[post.type]) {
        engagementByType[post.type] = { posts: 0, likes: 0, comments: 0 };
      }
      engagementByType[post.type].posts++;
      engagementByType[post.type].likes += post._count.likes;
      engagementByType[post.type].comments += post._count.comments;
    }

    const topPosts = [...userPosts]
      .sort((a, b) =>
        (b._count.likes + b._count.comments) - (a._count.likes + a._count.comments))
      .slice(0, 5)
      .map(post => ({
        id: post.id,
        title: post.title,
        type: post.type,
        likes: post._count.likes,
        comments: post._count.comments,
        engagement: post._count.likes + post._count.comments
      }));

    res.json({
      period: `${days} days`,
      summary: {
        totalPosts,
        totalLikes,
        totalComments,
        // The Mongoose Post had no views field, so this was always 0. Kept so the
        // response shape does not change under the frontend.
        totalViews: 0,
        averageLikesPerPost: totalPosts > 0 ? (totalLikes / totalPosts).toFixed(2) : 0,
        averageCommentsPerPost: totalPosts > 0 ? (totalComments / totalPosts).toFixed(2) : 0,
        totalEngagement: totalLikes + totalComments
      },
      engagementByType,
      topPosts
    });
  } catch (error: any) {
    logger.error('Error fetching engagement metrics', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch engagement metrics' });
  }
});

// Like/Unlike a comment
// Sits before /:postId/... only for grouping; the segment counts differ, so
// there was never a collision to avoid.
router.post('/comments/:commentId/like', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const commentId = req.params.commentId;

    if (!UUID.test(commentId)) {
      return res.status(400).json({ error: 'Invalid comment ID' });
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } }
    });

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      try {
        await prisma.commentLike.create({ data: { commentId, userId } });
      } catch (err: any) {
        // Two concurrent likes: the constraint decides, and the loser is already liked.
        if (err?.code !== 'P2002') throw err;
      }
    }

    const likesCount = await prisma.commentLike.count({ where: { commentId } });

    res.json({
      message: existing ? 'Comment unliked' : 'Comment liked',
      likesCount,
      isLiked: !existing
    });
  } catch (error: any) {
    logger.error('Error toggling comment like', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle comment like' });
  }
});

// Get a specific post
router.get('/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    if (!UUID.test(postId)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        _count: { select: { likes: true, comments: true } },
        comments: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [authors, likers] = await Promise.all([
      authorsById([post.authorId, ...post.comments.map(c => c.authorId)]),
      likersByPost([post.id])
    ]);

    res.json({
      post: {
        ...shapePost(post, authors.get(post.authorId) ?? null, likers.get(post.id) ?? []),
        comments: post.comments.map(c => ({
          ...withMongoId(c),
          authorId: asPopulated(authors.get(c.authorId)),
          author: authors.get(c.authorId) ?? null
        }))
      }
    });
  } catch (error: any) {
    logger.error('Error fetching post', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// Like/Unlike a post
router.post('/:postId/like', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const postId = req.params.postId;

    if (!UUID.test(postId)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } }
    });

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } });
    } else {
      try {
        await prisma.postLike.create({ data: { postId, userId } });
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }

    const likesCount = await prisma.postLike.count({ where: { postId } });

    res.json({
      message: existing ? 'Post unliked' : 'Post liked',
      likesCount,
      isLiked: !existing
    });
  } catch (error: any) {
    logger.error('Error toggling like', { error: error.message });
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Add comment to post
router.post('/:postId/comments', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const postId = req.params.postId;

    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid comment data',
        details: parsed.error.flatten()
      });
    }

    if (!UUID.test(postId)) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const { content, parentCommentId } = parsed.data;

    if (parentCommentId) {
      if (!UUID.test(parentCommentId)) {
        return res.status(400).json({ error: 'Invalid parent comment ID' });
      }
      const parent = await prisma.comment.findUnique({ where: { id: parentCommentId } });
      if (!parent || parent.postId !== postId) {
        return res.status(400).json({ error: 'Parent comment does not belong to this post' });
      }
    }

    // No push onto post.comments - the relation is the only record of it now.
    const comment = await prisma.comment.create({
      data: { postId, authorId: userId, content, parentCommentId: parentCommentId ?? null }
    });

    const authors = await authorsById([userId], 'name profilePhoto');

    logger.info('Comment added', { commentId: comment.id, postId, authorId: userId });

    res.status(201).json({
      message: 'Comment added successfully',
      comment: {
        ...withMongoId(comment),
        authorId: asPopulated(authors.get(userId)),
        author: authors.get(userId) ?? null
      }
    });
  } catch (error: any) {
    logger.error('Error adding comment', { error: error.message });
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Get comments for a post
router.get('/:postId/comments', async (req, res) => {
  try {
    const postId = req.params.postId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    if (!UUID.test(postId)) {
      return res.json({
        comments: [],
        pagination: { currentPage: page, totalPages: 0, totalComments: 0, hasNext: false, hasPrev: false }
      });
    }

    const [comments, totalComments] = await Promise.all([
      prisma.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.comment.count({ where: { postId } })
    ]);

    const authors = await authorsById(comments.map(c => c.authorId), 'name profilePhoto');

    res.json({
      comments: comments.map(c => ({
        ...withMongoId(c),
        authorId: asPopulated(authors.get(c.authorId)),
        author: authors.get(c.authorId) ?? null
      })),
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: page < Math.ceil(totalComments / limit),
        hasPrev: page > 1
      }
    });
  } catch (error: any) {
    logger.error('Error fetching comments', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Delete a post (only by author)
router.delete('/:postId', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    const postId = req.params.postId;

    if (!UUID.test(postId)) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    const post = await prisma.post.findFirst({ where: { id: postId, authorId: userId } });
    if (!post) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    // Comments and likes go with it - the foreign keys cascade, so there is no
    // second delete to forget.
    await prisma.post.delete({ where: { id: postId } });

    await User.findByIdAndUpdate(userId, { $inc: { 'socialStats.postsCount': -1 } });

    logger.info('Post deleted', { postId, authorId: userId });

    res.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting post', { error: error.message });
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
