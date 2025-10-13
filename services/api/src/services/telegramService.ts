import axios from 'axios';
import { logger } from '../utils/logger';

interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  reply_markup?: any;
}

interface BookingConfirmation {
  userName: string;
  tripTitle: string;
  tripDestination: string;
  startDate: string;
  endDate: string;
  totalTravelers: number;
  totalAmount: number;
  organizerName: string;
  organizerPhone: string;
  bookingId: string;
}

class TelegramService {
  private botToken: string;
  private apiUrl: string;
  private isConfigured: boolean = false;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.isConfigured = !!this.botToken;

    if (!this.isConfigured) {
      logger.warn('Telegram bot token not configured. Notifications will be disabled.');
    }
  }

  /**
   * Send a message to a Telegram chat
   */
  async sendMessage(chatId: string | number, message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown'): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn('Telegram service not configured');
      return false;
    }

    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: parseMode
      });

      if ((response.data as any).ok) {
        logger.info('Telegram message sent successfully', { 
          chatId: chatId.toString(),
          messageLength: message.length 
        });
        return true;
      } else {
        logger.error('Telegram API error', { error: response.data });
        return false;
      }
    } catch (error: any) {
      logger.error('Error sending Telegram message', { 
        error: error.message,
        chatId
      });
      return false;
    }
  }

  /**
   * Send booking confirmation
   */
  async sendBookingConfirmation(chatId: string | number, booking: BookingConfirmation): Promise<boolean> {
    const message = `🎉 *Booking Confirmed - TrekkTribe*\n\n` +
      `Hello ${booking.userName},\n\n` +
      `Your booking has been confirmed! Here are the details:\n\n` +
      `📍 *Trip:* ${booking.tripTitle}\n` +
      `🌍 *Destination:* ${booking.tripDestination}\n` +
      `📅 *Duration:* ${booking.startDate} to ${booking.endDate}\n` +
      `👥 *Travelers:* ${booking.totalTravelers}\n` +
      `💰 *Total Amount:* ₹${booking.totalAmount}\n` +
      `🎫 *Booking ID:* \`${booking.bookingId}\`\n\n` +
      `*Organizer Details:*\n` +
      `👨‍💼 ${booking.organizerName}\n` +
      `📞 ${booking.organizerPhone}\n\n` +
      `Thank you for choosing TrekkTribe! Have an amazing journey! 🚀\n\n` +
      `For support, contact us at tanejasaksham44@gmail.com or call 9876177839`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send booking reminder
   */
  async sendBookingReminder(chatId: string | number, userName: string, tripTitle: string, startDate: string, daysLeft: number): Promise<boolean> {
    const message = `⏰ *Trip Reminder - TrekkTribe*\n\n` +
      `Hello ${userName},\n\n` +
      `Your adventure "${tripTitle}" is starting in ${daysLeft} day${daysLeft > 1 ? 's' : ''}! 🎒\n\n` +
      `📅 *Start Date:* ${startDate}\n\n` +
      `*Pre-trip checklist:*\n` +
      `✅ Pack your essentials\n` +
      `✅ Carry valid ID proof\n` +
      `✅ Check weather forecast\n` +
      `✅ Charge your devices\n` +
      `✅ Keep emergency contacts handy\n\n` +
      `Have an amazing trip! 🌟\n\n` +
      `TrekkTribe Team`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(chatId: string | number, userName: string, tripTitle: string, pendingAmount: number, dueDate: string): Promise<boolean> {
    const message = `💳 *Payment Reminder - TrekkTribe*\n\n` +
      `Hello ${userName},\n\n` +
      `This is a friendly reminder about your pending payment:\n\n` +
      `🎯 *Trip:* ${tripTitle}\n` +
      `💰 *Pending Amount:* ₹${pendingAmount}\n` +
      `📅 *Due Date:* ${dueDate}\n\n` +
      `Please complete your payment to secure your booking.\n\n` +
      `You can pay through:\n` +
      `• Online payment portal\n` +
      `• UPI transfer\n` +
      `• Bank transfer\n\n` +
      `For assistance, contact your organizer or our support team.\n\n` +
      `TrekkTribe Team`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send welcome message
   */
  async sendWelcomeMessage(chatId: string | number, userName: string): Promise<boolean> {
    const message = `🎉 *Welcome to TrekkTribe!* 🌍\n\n` +
      `Hello ${userName},\n\n` +
      `Thank you for joining TrekkTribe - your gateway to incredible adventures!\n\n` +
      `*What you can do:*\n` +
      `🏔️ Discover amazing trips\n` +
      `👥 Connect with fellow travelers\n` +
      `📱 Track your bookings\n` +
      `⭐ Share your experiences\n\n` +
      `*Getting Started:*\n` +
      `1. Complete your profile\n` +
      `2. Browse our curated trips\n` +
      `3. Book your first adventure\n\n` +
      `Need help? Contact us anytime!\n` +
      `📧 tanejasaksham44@gmail.com\n📞 9876177839\n\n` +
      `Happy travels! 🚀`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Send group update to multiple users
   */
  async sendGroupUpdate(chatIds: (string | number)[], tripTitle: string, updateMessage: string, organizerName: string): Promise<number> {
    let successCount = 0;
    const message = `📢 *Group Update - ${tripTitle}*\n\n` +
      `${updateMessage}\n\n` +
      `*From:* ${organizerName}\n` +
      `*Time:* ${new Date().toLocaleString('en-IN')}\n\n` +
      `TrekkTribe Team`;

    for (const chatId of chatIds) {
      try {
        const sent = await this.sendMessage(chatId, message);
        if (sent) successCount++;
        // Add small delay between messages to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.error('Error sending group update to Telegram', { chatId, error });
      }
    }

    logger.info('Telegram group update sent', { 
      totalRecipients: chatIds.length, 
      successCount,
      tripTitle 
    });

    return successCount;
  }

  /**
   * Send trip cancellation notice
   */
  async sendTripCancellation(chatId: string | number, userName: string, tripTitle: string, refundAmount: number, reason: string): Promise<boolean> {
    const message = `❌ *Trip Cancellation - TrekkTribe*\n\n` +
      `Hello ${userName},\n\n` +
      `We regret to inform you that the trip "${tripTitle}" has been cancelled.\n\n` +
      `*Reason:* ${reason}\n\n` +
      `*Refund Details:*\n` +
      `💰 Refund Amount: ₹${refundAmount}\n` +
      `⏱️ Processing Time: 5-7 business days\n\n` +
      `The refund will be processed to your original payment method.\n\n` +
      `We apologize for the inconvenience and appreciate your understanding.\n\n` +
      `For any queries, please contact our support team.\n\n` +
      `TrekkTribe Team`;

    return this.sendMessage(chatId, message);
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<any> {
    if (!this.isConfigured) return null;

    try {
      const response = await axios.get(`${this.apiUrl}/getMe`);
      return response.data;
    } catch (error: any) {
      logger.error('Error getting Telegram bot info', { error: error.message });
      return null;
    }
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(webhookUrl: string): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      const response = await axios.post(`${this.apiUrl}/setWebhook`, {
        url: webhookUrl
      });

      return (response.data as any).ok;
    } catch (error: any) {
      logger.error('Error setting Telegram webhook', { error: error.message });
      return false;
    }
  }

  /**
   * Check if service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Get service status
   */
  async getServiceStatus(): Promise<{ configured: boolean; botInfo?: any }> {
    return {
      configured: this.isConfigured,
      botInfo: this.isConfigured ? await this.getBotInfo() : null
    };
  }
}

export const telegramService = new TelegramService();