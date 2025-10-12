import express from 'express';
import { z } from 'zod';
import { authenticateJwt } from '../middleware/auth';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const router = express.Router();

// Validation schemas
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

// Create a new post
router.post('/', authenticateJwt, async (req, res) => {
  try {
    const userId = (req as any).auth.userId;
    
    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid post data',
        details: parsed.error.flatten()
      });
    }

    const postData = {
      ...parsed.data,
      authorId: userId
    };

    const post = new Post(postData);
    await post.save();

    // Update user's post count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.postsCount': 1 }
    });

    // Populate author info
    await post.populate('authorId', 'name profilePhoto role');

    logger.info('Post created', { postId: post._id, authorId: userId });

    res.status(201).json({
      message: 'Post created successfully',
      post
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

    const filter: any = { isPublic: true };
    if (type) filter.type = type;
    if (authorId) filter.authorId = authorId;

    const posts = await Post.find(filter)
      .populate('authorId', 'name profilePhoto role')
      .populate('likes', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(filter);

    res.json({
      posts,
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

// Get a specific post
router.get('/:postId', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId)
      .populate('authorId', 'name profilePhoto role')
      .populate('likes', 'name')
      .populate({
        path: 'comments',
        populate: {
          path: 'authorId',
          select: 'name profilePhoto'
        }
      });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });
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

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      // Like
      post.likes.push(userId);
    }

    await post.save();

    res.json({
      message: isLiked ? 'Post unliked' : 'Post liked',
      likesCount: post.likes.length,
      isLiked: !isLiked
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

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = new Comment({
      ...parsed.data,
      postId,
      authorId: userId
    });

    await comment.save();

    // Add comment to post
    post.comments.push(comment._id);
    await post.save();

    // Populate author info
    await comment.populate('authorId', 'name profilePhoto');

    logger.info('Comment added', { commentId: comment._id, postId, authorId: userId });

    res.status(201).json({
      message: 'Comment added successfully',
      comment
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

    const comments = await Comment.find({ postId })
      .populate('authorId', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalComments = await Comment.countDocuments({ postId });

    res.json({
      comments,
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

    const post = await Post.findOne({ _id: postId, authorId: userId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found or unauthorized' });
    }

    await Post.findByIdAndDelete(postId);
    await Comment.deleteMany({ postId });

    // Update user's post count
    await User.findByIdAndUpdate(userId, {
      $inc: { 'socialStats.postsCount': -1 }
    });

    logger.info('Post deleted', { postId, authorId: userId });

    res.json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    logger.error('Error deleting post', { error: error.message });
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

export default router;
