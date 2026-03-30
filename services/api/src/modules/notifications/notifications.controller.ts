/**
 * Notifications Controller
 *
 * Thin HTTP layer — extracts params, calls service, returns response.
 * No business logic lives here.
 */

import { Request, Response } from 'express';
import * as notificationsService from './notifications.service';

export async function getNotifications(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === 'true';

    const result = await notificationsService.getNotifications(userId, limit, unreadOnly);
    return res.json(result);
  } catch (error: any) {
    console.error('❌ Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications', message: error.message });
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await notificationsService.getUnreadCount(userId);
    return res.json(result);
  } catch (error: any) {
    console.error('❌ Error getting unread count:', error);
    return res.status(500).json({ error: 'Failed to get unread count', message: error.message });
  }
}

export async function markAsRead(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await notificationsService.markAsRead(userId, req.params.id);
    return res.json({ message: 'Notification marked as read', notification });
  } catch (error: any) {
    console.error('❌ Error marking notification as read:', error);
    return res.status(error.status || 500).json({ error: 'Failed to update notification', message: error.message });
  }
}

export async function markAllAsRead(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await notificationsService.markAllAsRead(userId);
    return res.json({ message: 'All notifications marked as read', modifiedCount: result.modifiedCount });
  } catch (error: any) {
    console.error('❌ Error marking all as read:', error);
    return res.status(500).json({ error: 'Failed to update notifications', message: error.message });
  }
}

export async function deleteNotification(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    await notificationsService.deleteNotification(userId, req.params.id);
    return res.json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    console.error('❌ Error deleting notification:', error);
    return res.status(error.status || 500).json({ error: 'Failed to delete notification', message: error.message });
  }
}

export async function deleteReadNotifications(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const result = await notificationsService.deleteReadNotifications(userId);
    return res.json({ message: 'Read notifications deleted successfully', deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('❌ Error deleting notifications:', error);
    return res.status(500).json({ error: 'Failed to delete notifications', message: error.message });
  }
}

export async function createTestNotification(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const notification = await notificationsService.createTestNotification(userId);
    return res.json({ message: 'Test notification created', notification });
  } catch (error: any) {
    console.error('❌ Error creating test notification:', error);
    return res.status(500).json({ error: 'Failed to create notification', message: error.message });
  }
}
