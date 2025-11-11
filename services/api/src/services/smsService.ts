import { logger } from '../utils/logger';

interface SendOTPParams {
  phone: string;
  otp: string;
}

class SMSService {
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // SMS service is not configured - running in development mode only
    logger.warn('SMS service running in development mode only - OTPs will be logged instead of sent.');
    this.isConfigured = false;
  }

  /**
   * Send OTP via SMS (Development mode only)
   */
  async sendOTP({ phone, otp }: SendOTPParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Development mode - just log the OTP
    logger.info('📱 SMS OTP (DEV MODE)', { phone, otp });
    
    // Simulate success response
    return { 
      success: true, 
      messageId: 'dev-mode-' + Date.now() 
    };
  }

  /**
   * Send a general SMS message (Development mode only)
   */
  async sendMessage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Development mode - just log the message
    logger.info('📱 SMS (DEV MODE)', { phone, message });
    
    // Simulate success response
    return { success: true, messageId: 'dev-mode-' + Date.now() };
  }

  /**
   * Check if SMS service is properly configured (always false in dev mode)
   */
  isReady(): boolean {
    return false; // Always false since we're not using a real SMS service
  }

  /**
   * Get SMS service balance (not available in dev mode)
   */
  async getBalance(): Promise<{ balance?: string; currency?: string; error?: string }> {
    return { error: 'SMS service not configured - running in development mode' };
  }
}

// Export singleton instance
export const smsService = new SMSService();
