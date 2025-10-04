import twilio from 'twilio';

class SMSService {
  private client: any;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    // Validate Twilio credentials
    if (accountSid && 
        authToken && 
        accountSid.startsWith('AC') && 
        authToken.length > 20 && 
        !accountSid.includes('your_twilio')) {
      try {
        this.client = twilio(accountSid, authToken);
        console.log('✅ SMS Service (Twilio) initialized successfully');
      } catch (error) {
        console.warn('⚠️  SMS Service disabled: Failed to initialize Twilio client');
        this.client = null;
      }
    } else {
      console.warn('⚠️  SMS Service disabled: Twilio credentials not configured properly');
      this.client = null;
    }
  }

  async sendSMS(to: string, message: string): Promise<boolean> {
    if (!this.client) {
      console.error('Twilio client not initialized');
      return false;
    }

    try {
      // Ensure phone number is in international format
      const formattedPhone = to.startsWith('+') ? to : `+91${to}`;

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      console.log('SMS sent successfully:', result.sid);
      return true;
    } catch (error: any) {
      console.error('Error sending SMS:', error.message);
      return false;
    }
  }

  async sendOTPSMS(phone: string, otp: string, purpose: string): Promise<boolean> {
    const message = `Trek Tribe: Your OTP for ${purpose} is ${otp}. Valid for 10 minutes. Do not share this code. Happy Trekking! 🏔️`;
    
    return this.sendSMS(phone, message);
  }

  async sendBookingConfirmationSMS(
    phone: string, 
    bookingId: string, 
    tripTitle: string, 
    amount: number
  ): Promise<boolean> {
    const message = `Trek Tribe: Booking confirmed! ID: ${bookingId}. Trip: ${tripTitle}. Amount: ₹${amount}. Check email for details. Happy Trekking! 🏔️`;
    
    return this.sendSMS(phone, message);
  }

  async sendTripReminderSMS(
    phone: string, 
    tripTitle: string, 
    daysLeft: number
  ): Promise<boolean> {
    const message = `Trek Tribe: Your adventure "${tripTitle}" starts in ${daysLeft} days! Check your email for packing list and meeting details. Excited to trek with you! 🥾`;
    
    return this.sendSMS(phone, message);
  }

  async sendEmergencySMS(
    phone: string, 
    participantName: string, 
    tripTitle: string, 
    message: string
  ): Promise<boolean> {
    const emergencyMessage = `EMERGENCY ALERT - Trek Tribe: ${participantName} on trip "${tripTitle}": ${message}. Contact trip organizer immediately.`;
    
    return this.sendSMS(phone, emergencyMessage);
  }

  // Method to validate phone number format
  isValidPhoneNumber(phone: string): boolean {
    // Basic validation for Indian phone numbers
    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  }

  // Format phone number to international format
  formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return `+${cleaned}`;
    } else if (cleaned.length === 13 && cleaned.startsWith('+91')) {
      return cleaned;
    }
    
    return phone; // Return as-is if format is unclear
  }
}

export const smsService = new SMSService();