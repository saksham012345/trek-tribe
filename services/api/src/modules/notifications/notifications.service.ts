/**
 * Notifications Service
 *
 * All business logic extracted from routes/notifications.ts.
 * No req/res objects — pure data in, data out.
 */

import Notification from '../../models/Notification';

export async function getNotifications(userId: string, limit: number, unreadOnly: boolean) {
  const query: any = { userId };
  if (unreadOnly) query.isRead = false;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const unreadCount = await Notification.countDocuments({ userId, isRead: false });

  return { notifications, unreadCount, total: notifications.length };
}

export async function getUnreadCount(userId: string) {
  const count = await Notification.countDocuments({ userId, isRead: false });
  return { count };
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) throw Object.assign(new Error('Notification not found'), { status: 404 });

  notification.isRead = true;
  await notification.save();
  return notification;
}

export async function markAllAsRead(userId: string) {
  const result = await Notification.updateMany({ userId, isRead: false }, { isRead: true });
  return { modifiedCount: result.modifiedCount };
}

export async function deleteNotification(userId: string, notificationId: string) {
  const notification = await Notification.findOne({ _id: notificationId, userId });
  if (!notification) throw Object.assign(new Error('Notification not found'), { status: 404 });

  await Notification.findByIdAndDelete(notificationId);
}

export async function deleteReadNotifications(userId: string) {
  const result = await Notification.deleteMany({ userId, isRead: true });
  return { deletedCount: result.deletedCount };
}

export async function createTestNotification(userId: string) {
  const notification = await Notification.create({
    userId,
    type: 'system',
    title: 'Test Notification',
    message: 'This is a test notification created for development purposes.',
    isRead: false,
  });
  return notification;
}
