import { Router } from 'express';
import { authenticateJwt } from '../middleware/auth';
import * as notificationsController from '../modules/notifications/notifications.controller';

const router = Router();

/**
 * GET /api/notifications
 */
router.get('/', authenticateJwt, notificationsController.getNotifications);

/**
 * GET /api/notifications/unread-count
 */
router.get('/unread-count', authenticateJwt, notificationsController.getUnreadCount);

/**
 * PUT /api/notifications/mark-all-read
 */
router.put('/mark-all-read', authenticateJwt, notificationsController.markAllAsRead);

/**
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticateJwt, notificationsController.markAsRead);

/**
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticateJwt, notificationsController.deleteNotification);

/**
 * DELETE /api/notifications
 */
router.delete('/', authenticateJwt, notificationsController.deleteReadNotifications);

if (process.env.NODE_ENV === 'development') {
  router.post('/test', authenticateJwt, notificationsController.createTestNotification);
}

export default router;
