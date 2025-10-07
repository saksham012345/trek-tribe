import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

interface WhatsAppMessage {
  phoneNumber: string;
  message: string;
  media?: string; // Optional media attachment path
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

class WhatsAppService {
  private client: Client;
  private isReady: boolean = false;
  private isInitializing: boolean = false;

  constructor() {
    // Initialize WhatsApp client with local authentication
    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'trek-tribe-bot',
        dataPath: path.join(__dirname, '../../.wwebjs_auth')
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('qr', (qr) => {
      console.log('\n🔗 WhatsApp QR Code:');
      console.log('Please scan this QR code with your WhatsApp mobile app to authenticate the bot:');
      qrcode.generate(qr, { small: true });
      logger.info('WhatsApp QR code generated for authentication');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      this.isReady = true;
      this.isInitializing = false;
      logger.info('WhatsApp service initialized and ready');
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated successfully!');
      logger.info('WhatsApp authentication successful');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      logger.error('WhatsApp authentication failed', { error: msg });
      this.isReady = false;
      this.isInitializing = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp client disconnected:', reason);
      logger.warn('WhatsApp client disconnected', { reason });
      this.isReady = false;
    });

    this.client.on('message_create', async (message) => {
      // Handle incoming messages if needed
      if (message.fromMe) return;
      
      // Log incoming messages for debugging
      logger.info('Received WhatsApp message', {
        from: message.from,
        body: message.body?.substring(0, 100) // Log first 100 chars
      });
    });
  }

  async initialize(): Promise<void> {
    if (this.isReady) {
      return;
    }

    if (this.isInitializing) {
      // Wait for current initialization to complete
      while (this.isInitializing && !this.isReady) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return;
    }

    this.isInitializing = true;
    
    try {
      console.log('🚀 Initializing WhatsApp service...');
      await this.client.initialize();
      
      // Wait for ready state or timeout after 60 seconds
      const timeout = setTimeout(() => {
        if (!this.isReady) {
          logger.error('WhatsApp initialization timeout');
          this.isInitializing = false;
        }
      }, 60000);

      while (!this.isReady && this.isInitializing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      clearTimeout(timeout);
      
      if (!this.isReady) {
        throw new Error('WhatsApp initialization failed or timed out');
      }
      
    } catch (error) {
      logger.error('Error initializing WhatsApp service', { error });
      this.isInitializing = false;
      throw error;
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp service not initialized');
      }

      // Format phone number (remove spaces, add country code if missing)
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      await this.client.sendMessage(chatId, message);
      logger.info('WhatsApp message sent successfully', { 
        phoneNumber: formattedNumber,
        messageLength: message.length 
      });
      
      return true;
    } catch (error) {
      logger.error('Error sending WhatsApp message', { 
        phoneNumber, 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  async sendMediaMessage(phoneNumber: string, message: string, mediaPath: string): Promise<boolean> {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp service not initialized');
      }

      if (!fs.existsSync(mediaPath)) {
        throw new Error(`Media file not found: ${mediaPath}`);
      }

      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      const media = MessageMedia.fromFilePath(mediaPath);
      await this.client.sendMessage(chatId, media, { caption: message });
      
      logger.info('WhatsApp media message sent successfully', { 
        phoneNumber: formattedNumber,
        mediaPath,
        messageLength: message.length 
      });
      
      return true;
    } catch (error) {
      logger.error('Error sending WhatsApp media message', { 
        phoneNumber, 
        mediaPath,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let formatted = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assuming India +91 for now)
    if (formatted.length === 10) {
      formatted = '91' + formatted;
    }
    
    return formatted;
  }

  // Message Templates
  createBookingConfirmationMessage(booking: BookingConfirmation): string {
    return `🎯 *Trek Tribe - Booking Confirmed!*

✅ Hello ${booking.userName}! Your booking has been confirmed.

🏔️ *Trip Details:*
📍 ${booking.tripTitle} - ${booking.tripDestination}
📅 ${booking.startDate} to ${booking.endDate}
👥 Travelers: ${booking.totalTravelers}
💰 Total Amount: ₹${booking.totalAmount}

👤 *Organizer:*
${booking.organizerName}
📞 ${booking.organizerPhone}

🆔 *Booking ID:* ${booking.bookingId}

📱 You will receive further updates about your trip on WhatsApp.

🌟 *Important:*
• Please save the organizer's contact
• Join our trip WhatsApp group (link will be shared soon)
• Keep your booking ID handy for reference

Happy Trekking! 🥾✨

_Trek Tribe Team_`;
  }

  createTripReminderMessage(userName: string, tripTitle: string, daysLeft: number): string {
    return `⏰ *Trek Tribe Reminder*

Hi ${userName}! 👋

🏔️ Your adventure "${tripTitle}" is starting in *${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}*!

🎒 *Don't forget to:*
• Pack your essentials
• Check weather conditions
• Contact your organizer if needed
• Join the trip WhatsApp group

Get ready for an amazing experience! 🌟

_Trek Tribe Team_`;
  }

  createTripUpdateMessage(userName: string, tripTitle: string, updateMessage: string): string {
    return `📢 *Trip Update - ${tripTitle}*

Hi ${userName}! 

${updateMessage}

For any questions, please contact your trip organizer.

_Trek Tribe Team_`;
  }

  async sendBookingConfirmation(booking: BookingConfirmation): Promise<boolean> {
    const message = this.createBookingConfirmationMessage(booking);
    return await this.sendMessage(booking.organizerPhone, message);
  }

  async sendTripReminder(phoneNumber: string, userName: string, tripTitle: string, daysLeft: number): Promise<boolean> {
    const message = this.createTripReminderMessage(userName, tripTitle, daysLeft);
    return await this.sendMessage(phoneNumber, message);
  }

  async sendTripUpdate(phoneNumber: string, userName: string, tripTitle: string, updateMessage: string): Promise<boolean> {
    const message = this.createTripUpdateMessage(userName, tripTitle, updateMessage);
    return await this.sendMessage(phoneNumber, message);
  }

  // Utility methods
  isServiceReady(): boolean {
    return this.isReady;
  }

  async getStatus(): Promise<{
    isReady: boolean;
    isInitializing: boolean;
    clientInfo?: any;
  }> {
    try {
      const clientInfo = this.isReady ? await this.client.getState() : null;
      return {
        isReady: this.isReady,
        isInitializing: this.isInitializing,
        clientInfo
      };
    } catch (error) {
      return {
        isReady: this.isReady,
        isInitializing: this.isInitializing,
        clientInfo: null
      };
    }
  }

  async destroy(): Promise<void> {
    try {
      if (this.client) {
        await this.client.destroy();
      }
      this.isReady = false;
      this.isInitializing = false;
      logger.info('WhatsApp service destroyed');
    } catch (error) {
      logger.error('Error destroying WhatsApp service', { error });
    }
  }
}

// Export singleton instance
export const whatsappService = new WhatsAppService();
export { WhatsAppService };