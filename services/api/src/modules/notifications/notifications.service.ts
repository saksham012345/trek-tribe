/**
 * Notifications Service
 *
 * All business logic extracted from routes/notifications.ts.
 * No req/res objects — pure data in, data out.
 *
 * Moved to Postgres in D10/D11 wave 3. `userId` holds a Mongo ObjectId string
 * with no foreign key until User lands in wave 9.
 *
 * markAsRead and markAllAsRead now set `readAt`. services/notificationService.ts
 * already did; this module did not, so whether a notification ended up with a
 * read timestamp depended on which of the two paths marked it. Both set it now.
 */

import { prisma } from '../../lib/prisma';

export async function getNotifications(userId: string, limit: number, unreadOnly: boolean) {
  const where: any = { userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.notification.count({ where: { userId, isRead: false } })
  ]);

  return { notifications, unreadCount, total: notifications.length };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { count };
}

export async function markAsRead(userId: string, notificationId: string) {
  // Scoped by userId as well as id, so one user cannot mark another's as read.
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() }
  });

  if (result.count === 0) {
    throw Object.assign(new Error('Notification not found'), { status: 404 });
  }

  return await prisma.notification.findUnique({ where: { id: notificationId } });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() }
  });
  return { modifiedCount: result.count };
}

export async function deleteNotification(userId: string, notificationId: string) {
  const result = await prisma.notification.deleteMany({
    where: { id: notificationId, userId }
  });

  if (result.count === 0) {
    throw Object.assign(new Error('Notification not found'), { status: 404 });
  }
}

export async function deleteReadNotifications(userId: string) {
  const result = await prisma.notification.deleteMany({ where: { userId, isRead: true } });
  return { deletedCount: result.count };
}

export async function createTestNotification(userId: string) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type: 'system',
      title: 'Test Notification',
      message: 'This is a test notification created for development purposes.',
      isRead: false
    }
  });
  return notification;
}
