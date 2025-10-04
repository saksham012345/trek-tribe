import { Twilio } from 'twilio';
import { User } from '../models/User';

class SMSService {
  private client: Twilio | null = null;
  private isEnabled: boolean = false;
  private fromNumber: string = '';

  constructor() {
    this.setupTwilio();
  }

  private setupTwilio() {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

      if (!accountSid || !authToken || !this.fromNumber) {
        console.warn('⚠️  SMS Service: Twilio credentials not configured');
        return;
      }

      this.client = new Twilio(accountSid, authToken);
      this.isEnabled = true;
      console.log('✅ SMS Service initialized successfully');
    } catch (error) {
      console.error('❌ SMS Service initialization failed:', error);
      this.isEnabled = false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assuming +91 for India)
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    } else if (cleaned.length === 13 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    }
    
    // Return as is if already formatted or different country
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  }

  async sendUrgentChatNotification(userId: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;

    try {
      const user = await User.findById(userId).select('name phone');
      if (!user || !user.phone) {
        console.log(`No phone number found for user ${userId}`);
        return false;
      }

      const phoneNumber = this.formatPhoneNumber(user.phone);
      const message = `🚨 Trek Tribe Alert: Your urgent support chat has been created. Chat ID: ${chatData.roomId}. Agent will respond shortly. Check your email for details.`;

      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 Urgent chat SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send urgent chat SMS:', error);
      return false;
    }
  }

  async sendAgentUrgentAssignment(agentPhone: string, chatData: any): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;

    try {
      const phoneNumber = this.formatPhoneNumber(agentPhone);
      const message = `🚨 Trek Tribe Agent Alert: Urgent chat assigned to you. Customer: ${chatData.userName}, Priority: ${chatData.priority}. Login to handle immediately.`;

      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 Agent urgent assignment SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send agent urgent assignment SMS:', error);
      return false;
    }
  }

  async sendCriticalSystemAlert(adminPhones: string[], alertData: any): Promise<number> {
    if (!this.isEnabled || !this.client) return 0;

    let sentCount = 0;
    const message = `🚨 Trek Tribe Critical Alert: ${alertData.message}. Immediate attention required.`;

    for (const phone of adminPhones) {
      try {
        const phoneNumber = this.formatPhoneNumber(phone);
        
        await this.client.messages.create({
          body: message,
          from: this.fromNumber,
          to: phoneNumber,
        });

        sentCount++;
        console.log(`📱 Critical alert SMS sent to ${phoneNumber}`);
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Failed to send critical alert SMS to ${phone}:`, error);
      }
    }

    console.log(`📱 Critical alert SMS sent to ${sentCount}/${adminPhones.length} admins`);
    return sentCount;
  }

  async sendBulkSMS(recipients: { phone: string; name?: string }[], message: string): Promise<number> {
    if (!this.isEnabled || !this.client) return 0;

    let sentCount = 0;
    const batchSize = 5; // Twilio rate limits

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      try {
        await Promise.all(
          batch.map(async (recipient) => {
            const phoneNumber = this.formatPhoneNumber(recipient.phone);
            const personalizedMessage = recipient.name 
              ? message.replace('{name}', recipient.name)
              : message;

            await this.client!.messages.create({
              body: personalizedMessage,
              from: this.fromNumber,
              to: phoneNumber,
            });
            
            sentCount++;
          })
        );
        
        // Delay between batches to avoid rate limits
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error(`❌ Failed to send bulk SMS to batch ${i / batchSize + 1}:`, error);
      }
    }

    console.log(`📱 Bulk SMS sent to ${sentCount}/${recipients.length} recipients`);
    return sentCount;
  }

  async sendOTPSMS(phone: string, otp: string): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;

    try {
      const phoneNumber = this.formatPhoneNumber(phone);
      const message = `Your Trek Tribe verification code is: ${otp}. Valid for 10 minutes. Don't share this code with anyone.`;

      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 OTP SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send OTP SMS:', error);
      return false;
    }
  }

  async sendBookingConfirmationSMS(phone: string, bookingData: any): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;

    try {
      const phoneNumber = this.formatPhoneNumber(phone);
      const message = `🏔️ Trek Tribe: Your booking for "${bookingData.tripName}" is confirmed! Trip starts ${bookingData.startDate}. Booking ID: ${bookingData.bookingId}. Safe travels!`;

      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 Booking confirmation SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send booking confirmation SMS:', error);
      return false;
    }
  }

  async sendTripReminderSMS(phone: string, tripData: any): Promise<boolean> {
    if (!this.isEnabled || !this.client) return false;

    try {
      const phoneNumber = this.formatPhoneNumber(phone);
      const message = `🎒 Trek Tribe Reminder: Your trek "${tripData.tripName}" starts in ${tripData.daysUntil} days (${tripData.startDate}). Check your preparation checklist in the app!`;

      await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: phoneNumber,
      });

      console.log(`📱 Trip reminder SMS sent to ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send trip reminder SMS:', error);
      return false;
    }
  }

  isServiceEnabled(): boolean {
    return this.isEnabled;
  }

  getFromNumber(): string {
    return this.fromNumber;
  }
}

// Singleton instance
export const smsService = new SMSService();