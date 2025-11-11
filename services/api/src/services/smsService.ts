import twilio from 'twilio';
import { logger } from '../utils/logger';

interface SendOTPParams {
  phone: string;
  otp: string;
}

class SMSService {
  private client: twilio.Twilio | null = null;
  private fromNumber: string | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      logger.warn('Twilio credentials not configured. SMS service will run in dev mode.');
      this.isConfigured = false;
      return;
    }

    try {
      this.client = twilio(accountSid, authToken);
      this.fromNumber = fromNumber;
      this.isConfigured = true;
      logger.info('Twilio SMS service initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize Twilio client', { error: error.message });
      this.isConfigured = false;
    }
  }

  /**
   * Send OTP via SMS using Twilio
   */
  async sendOTP({ phone, otp }: SendOTPParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Development mode - just log
    if (!this.isConfigured || process.env.NODE_ENV === 'development') {
      logger.info('📱 SMS OTP (DEV MODE)', { phone, otp });
      return { 
        success: true, 
        messageId: 'dev-mode-' + Date.now() 
      };
    }

    if (!this.client || !this.fromNumber) {
      logger.error('Twilio client not initialized');
      return { 
        success: false, 
        error: 'SMS service not configured' 
      };
    }

    try {
      // Format message
      const message = `Your Trek Tribe verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this message.`;

      // Send SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phone
      });

      logger.info('SMS OTP sent successfully', { 
        phone, 
        messageId: result.sid,
        status: result.status 
      });

      return { 
        success: true, 
        messageId: result.sid 
      };

    } catch (error: any) {
      // Handle Twilio-specific errors
      if (error.code) {
        logger.error('Twilio API error', {
          code: error.code,
          message: error.message,
          phone,
          details: error.moreInfo
        });

        // Return user-friendly error messages
        switch (error.code) {
          case 21211:
            return { success: false, error: 'Invalid phone number format' };
          case 21408:
            return { success: false, error: 'Phone number does not receive SMS' };
          case 21610:
            return { success: false, error: 'Phone number is blocked or unsubscribed' };
          case 21614:
            return { success: false, error: 'Invalid phone number for this region' };
          case 30003:
            return { success: false, error: 'Phone number is unreachable' };
          case 30005:
            return { success: false, error: 'Phone number is unknown or unavailable' };
          case 30006:
            return { success: false, error: 'Phone number is on a landline' };
          default:
            return { success: false, error: 'Failed to send SMS. Please try again.' };
        }
      }

      logger.error('Unexpected error sending SMS', { 
        error: error.message,
        phone 
      });

      return { 
        success: false, 
        error: 'Failed to send SMS. Please try again.' 
      };
    }
  }

  /**
   * Send a general SMS message
   */
  async sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured) {
      logger.info('📱 SMS (DEV MODE)', { phone, message });
      return { success: true, messageId: 'dev-mode-' + Date.now() };
    }

    if (!this.client || !this.fromNumber) {
      return { success: false, error: 'SMS service not configured' };
    }

    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phone
      });

      logger.info('SMS sent successfully', { 
        phone, 
        messageId: result.sid 
      });

      return { 
        success: true, 
        messageId: result.sid 
      };

    } catch (error: any) {
      logger.error('Error sending SMS', { 
        error: error.message,
        code: error.code,
        phone 
      });

      return { 
        success: false, 
        error: error.message || 'Failed to send SMS' 
      };
    }
  }

  /**
   * Check if SMS service is properly configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get Twilio account balance (optional, for monitoring)
   */
  async getBalance(): Promise<{ balance?: string; currency?: string; error?: string }> {
    if (!this.client) {
      return { error: 'SMS service not configured' };
    }

    try {
      const account = await this.client.balance.fetch();
      return {
        balance: account.balance,
        currency: account.currency
      };
    } catch (error: any) {
      logger.error('Error fetching Twilio balance', { error: error.message });
      return { error: error.message };
    }
  }
}

// Export singleton instance
export const smsService = new SMSService();
