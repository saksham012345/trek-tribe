import { prisma } from '../lib/prisma';
import mongoose from 'mongoose';

interface CreateNotificationParams {
  userId: string | mongoose.Types.ObjectId;
  type: 'ticket' | 'chat' | 'verification' | 'payment' | 'booking' | 'lead' | 'system' | 'reminder';
  title: string;
  message: string;
  priority?: 'low' | 'medium' | 'high';
  actionUrl?: string;
  actionType?: 'view_ticket' | 'view_trip' | 'make_payment' | 'verify_trip' | 'respond_chat' | 'view_lead';
  relatedTo?: {
    type: 'ticket' | 'trip' | 'booking' | 'payment' | 'lead' | 'chat';
    id: string | mongoose.Types.ObjectId;
  };
  metadata?: any;
  sendEmail?: boolean;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(params: CreateNotificationParams) {
    try {
      // relatedTo was a nested { type, id }; it is two columns now, so a query
      // like "unread booking notifications" reads a column instead of digging
      // through JSON.
      const notification = await prisma.notification.create({
        data: {
          userId: String(params.userId),
          type: params.type,
          title: params.title,
          message: params.message,
          priority: params.priority || 'medium',
          actionUrl: params.actionUrl,
          actionType: params.actionType,
          relatedToType: params.relatedTo?.type,
          relatedToId: params.relatedTo ? String(params.relatedTo.id) : undefined,
          metadata: params.metadata ?? undefined,
          emailSent: false,
        }
      });

      // Send email if requested
      if (params.sendEmail) {
        await this.sendEmailNotification(notification);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification (integrate with your email service)
   */
  private async sendEmailNotification(notification: any) {
    try {
      // TODO: Integrate with nodemailer or your email service
      // This is a placeholder
      console.log('Sending email notification:', {
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
      });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true, emailSentAt: new Date() }
      });
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, options: {
    limit?: number;
    skip?: number;
    unreadOnly?: boolean;
  } = {}) {
    try {
      const where: any = { userId };

      if (options.unreadOnly) {
        where.isRead = false;
      }

      const [notifications, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: options.limit || 50,
          skip: options.skip || 0
        }),
        prisma.notification.count({ where: { userId, isRead: false } })
      ]);

      return {
        notifications,
        unreadCount,
      };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    try {
      const notification = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() }
      });

      return notification;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    try {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: new Date() }
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete old notifications (cleanup task)
   */
  async deleteOldNotifications(daysOld: number = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.notification.deleteMany({
        where: { createdAt: { lt: cutoffDate }, isRead: true }
      });

      return result.count;
    } catch (error) {
      console.error('Error deleting old notifications:', error);
      throw error;
    }
  }
}

export default new NotificationService();
