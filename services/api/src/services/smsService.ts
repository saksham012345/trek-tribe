import axios from 'axios';
import { logger } from '../utils/logger';
import { getSiteSettings } from './siteSettingsService';

interface SendOTPParams {
  phone: string;
  otp: string;
}

class SMSService {
  private isConfigured = false;
  private accountSid = '';
  private authToken = '';
  private fromNumber = '';

  constructor() {
    this.initialize();
  }

  private initialize() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '';
    this.isConfigured = !!(this.accountSid && this.authToken && this.fromNumber);

    if (this.isConfigured) {
      logger.info('SMS service initialized with Twilio provider');
    } else {
      logger.warn('SMS service running in fallback mode (Twilio credentials missing).');
    }
  }

  private async isSmsEnabledBySettings() {
    try {
      const settings = await getSiteSettings();
      if (settings.integrations?.smsProvider === 'disabled') return false;
      return settings.notifications?.smsEnabled === true;
    } catch {
      return process.env.ENABLE_SMS === 'true';
    }
  }

  private async resolveFromNumber() {
    try {
      const settings = await getSiteSettings();
      return settings.integrations?.twilioFromNumber || this.fromNumber;
    } catch {
      return this.fromNumber;
    }
  }

  private async sendViaTwilio(phone: string, message: string) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams();
    body.append('To', phone);
    body.append('From', await this.resolveFromNumber());
    body.append('Body', message);

    const response = await axios.post(url, body.toString(), {
      auth: {
        username: this.accountSid,
        password: this.authToken
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    return response.data?.sid as string | undefined;
  }

  async sendOTP({ phone, otp }: SendOTPParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const message = `Your TrekTribe OTP is ${otp}. It expires in 10 minutes.`;
    return this.sendMessage(phone, message);
  }

  async sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const smsEnabled = await this.isSmsEnabledBySettings();
      if (!smsEnabled) {
        logger.info('SMS disabled by settings; skipping send', { phone });
        return { success: false, error: 'SMS is disabled in settings' };
      }

      if (!this.isConfigured) {
        logger.warn('SMS fallback mode (no Twilio credentials). Logging message only.', { phone, message });
        if (process.env.NODE_ENV === 'development') {
          return { success: true, messageId: 'dev-mode-' + Date.now() };
        }
        return { success: false, error: 'Twilio credentials are not configured' };
      }

      const messageId = await this.sendViaTwilio(phone, message);
      logger.info('SMS sent successfully', { phone, messageId });
      return { success: true, messageId };
    } catch (error: any) {
      logger.error('SMS send failed', { phone, error: error?.message });
      return { success: false, error: error?.message || 'Failed to send SMS' };
    }
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  async getBalance(): Promise<{ balance?: string; currency?: string; error?: string }> {
    if (!this.isConfigured) {
      return { error: 'SMS service not configured' };
    }
    return { error: 'Balance lookup is not implemented yet' };
  }
}

export const smsService = new SMSService();
