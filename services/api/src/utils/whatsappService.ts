import axios from 'axios';

class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private isConfigured: boolean = false;

  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    
    if (this.accessToken && 
        this.phoneNumberId && 
        this.accessToken.length > 20 &&
        !this.accessToken.includes('your_token')) {
      this.isConfigured = true;
      console.log('✅ WhatsApp Service initialized successfully');
    } else {
      console.warn('⚠️  WhatsApp Service disabled: Credentials not configured properly');
      this.isConfigured = false;
    }
  }

  async sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('WhatsApp service not configured - skipping message send');
      return false;
    }

    try {
      // Format phone number for WhatsApp (remove + and spaces)
      const formattedPhone = to.replace(/[^\d]/g, '');
      
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: formattedPhone,
          text: { body: message },
          type: 'text'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('WhatsApp message sent:', response.data.messages[0].id);
      return true;
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error.response?.data || error.message);
      return false;
    }
  }

  async sendOTPWhatsApp(phone: string, otp: string, purpose: string): Promise<boolean> {
    const message = `🏔️ *Trek Tribe*\n\nYour OTP for ${purpose}: *${otp}*\n\nValid for 10 minutes only.\n🔒 Do not share this code.\n\nHappy Trekking! 🥾`;
    
    return this.sendWhatsAppMessage(phone, message);
  }

  async sendBookingConfirmationWhatsApp(
    phone: string, 
    bookingId: string, 
    tripTitle: string, 
    amount: number
  ): Promise<boolean> {
    const message = `🎉 *Booking Confirmed!*\n\n🏔️ *Trek Tribe*\n📋 Booking ID: ${bookingId}\n🗺️ Trip: ${tripTitle}\n💰 Amount: ₹${amount}\n\n📧 Check your email for complete details.\n\nHappy Trekking! 🥾⛰️`;
    
    return this.sendWhatsAppMessage(phone, message);
  }
}

export const whatsappService = new WhatsAppService();