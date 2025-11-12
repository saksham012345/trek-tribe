import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../middleware/auth';
import Notification from '../models/Notification';
import { z } from 'zod';

const router = Router();

/**
 * GET /api/notifications
 * Get user's notifications
 */
router.get('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const query: any = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.json({
      notifications,
      unreadCount,
      total: notifications.length
    });

  } catch (error: any) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch notifications',
      message: error.message 
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Get count of unread notifications
 */
router.get('/unread-count', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await Notification.countDocuments({ userId, isRead: false });

    return res.json({ count });

  } catch (error: any) {
    console.error('❌ Error getting unread count:', error);
    return res.status(500).json({ 
      error: 'Failed to get unread count',
      message: error.message 
    });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read
 */
router.put('/:id/read', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const notificationId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({ _id: notificationId, userId });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    await notification.save();

    return res.json({ 
      message: 'Notification marked as read',
      notification 
    });

  } catch (error: any) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(500).json({ 
      error: 'Failed to update notification',
      message: error.message 
    });
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read
 */
router.put('/mark-all-read', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return res.json({ 
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount 
    });

  } catch (error: any) {
    console.error('❌ Error marking all as read:', error);
    return res.status(500).json({ 
      error: 'Failed to update notifications',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const notificationId = req.params.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const notification = await Notification.findOne({ _id: notificationId, userId });

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    await Notification.findByIdAndDelete(notificationId);

    return res.json({ 
      message: 'Notification deleted successfully' 
    });

  } catch (error: any) {
    console.error('❌ Error deleting notification:', error);
    return res.status(500).json({ 
      error: 'Failed to delete notification',
      message: error.message 
    });
  }
});

/**
 * DELETE /api/notifications
 * Delete all read notifications
 */
router.delete('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await Notification.deleteMany({ userId, isRead: true });

    return res.json({ 
      message: 'Read notifications deleted successfully',
      deletedCount: result.deletedCount 
    });

  } catch (error: any) {
    console.error('❌ Error deleting notifications:', error);
    return res.status(500).json({ 
      error: 'Failed to delete notifications',
      message: error.message 
    });
  }
});

/**
 * POST /api/notifications/test
 * Create a test notification (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', authenticateJwt, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.userId;
      
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const notification = await Notification.create({
        userId,
        type: 'system',
        title: 'Test Notification',
        message: 'This is a test notification created for development purposes.',
        isRead: false
      });

      return res.json({ 
        message: 'Test notification created',
        notification 
      });

    } catch (error: any) {
      console.error('❌ Error creating test notification:', error);
      return res.status(500).json({ 
        error: 'Failed to create notification',
        message: error.message 
      });
    }
  });
}

export default router;
