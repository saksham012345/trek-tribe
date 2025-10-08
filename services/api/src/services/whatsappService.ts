import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

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
      console.log('Please scan this QR code with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
      logger.info('WhatsApp QR code generated');
    });

    this.client.on('ready', () => {
      console.log('✅ WhatsApp client is ready!');
      this.isReady = true;
      this.isInitializing = false;
      logger.info('WhatsApp service ready');
    });

    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated!');
      logger.info('WhatsApp authentication successful');
    });

    this.client.on('auth_failure', (msg) => {
      console.error('❌ WhatsApp authentication failed:', msg);
      logger.error('WhatsApp auth failed', { error: msg });
      this.isReady = false;
      this.isInitializing = false;
    });

    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp disconnected:', reason);
      logger.warn('WhatsApp disconnected', { reason });
      this.isReady = false;
    });
  }

  async initialize(): Promise<void> {
    if (this.isReady || this.isInitializing) return;

    this.isInitializing = true;
    
    try {
      console.log('🚀 Initializing WhatsApp service...');
      await this.client.initialize();
    } catch (error) {
      logger.error('WhatsApp initialization error', { error });
      this.isInitializing = false;
      throw error;
    }
  }

  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      logger.warn('WhatsApp not ready');
      return false;
    }

    try {
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      const chatId = `${formattedNumber}@c.us`;

      await this.client.sendMessage(chatId, message);
      logger.info('WhatsApp message sent', { phoneNumber: formattedNumber });
      return true;
    } catch (error: any) {
      logger.error('WhatsApp send error', { error: error.message, phoneNumber });
      return false;
    }
  }

  async sendBookingConfirmation(phoneNumber: string, booking: BookingConfirmation): Promise<boolean> {
    const message = `🎉 *Booking Confirmed - TrekkTribe*\n\n` +
      `Hello ${booking.userName},\n\n` +
      `Your booking is confirmed!\n\n` +
      `📍 Trip: ${booking.tripTitle}\n` +
      `🌍 Destination: ${booking.tripDestination}\n` +
      `📅 ${booking.startDate} to ${booking.endDate}\n` +
      `👥 Travelers: ${booking.totalTravelers}\n` +
      `💰 Amount: ₹${booking.totalAmount}\n` +
      `🎫 Booking ID: ${booking.bookingId}\n\n` +
      `Organizer: ${booking.organizerName}\n` +
      `📞 ${booking.organizerPhone}\n\n` +
      `Thank you for choosing TrekkTribe! 🚀`;

    return this.sendMessage(phoneNumber, message);
  }

  private formatPhoneNumber(phoneNumber: string): string {
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '91' + cleaned.substring(1);
    }
    
    return cleaned;
  }

  async getServiceStatus(): Promise<{ isReady: boolean; isInitializing: boolean }> {
    return {
      isReady: this.isReady,
      isInitializing: this.isInitializing
    };
  }

  isServiceReady(): boolean {
    return this.isReady;
  }

  async getStatus(): Promise<{ isReady: boolean; isInitializing: boolean }> {
    return this.getServiceStatus();
  }

  async shutdown(): Promise<void> {
    try {
      if (this.client) {
        await this.client.destroy();
        logger.info('WhatsApp service shut down');
      }
    } catch (error) {
      logger.error('WhatsApp shutdown error', { error });
    } finally {
      this.isReady = false;
      this.isInitializing = false;
    }
  }
}

export const whatsappService = new WhatsAppService();