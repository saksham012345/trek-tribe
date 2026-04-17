import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

interface BookingEmailData {
  userName: string;
  userEmail: string;
  tripTitle: string;
  tripDestination: string;
  startDate: string;
  endDate: string;
  totalTravelers: number;
  totalAmount: number;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  bookingId: string;
}

interface PasswordResetData {
  userName: string;
  userEmail: string;
  resetToken: string;
  resetUrl: string;
}

interface TripUpdateData {
  userName: string;
  userEmail: string;
  tripTitle: string;
  updateMessage: string;
  organizerName: string;
}

interface PaymentScreenshotData {
  travelerName: string;
  travelerEmail: string;
  tripTitle: string;
  bookingId: string;
  totalAmount: number;
  organizerName: string;
  organizerEmail: string;
  screenshotUrl: string;
}

interface AgentReplyData {
  userName: string;
  userEmail: string;
  ticketId: string;
  ticketSubject: string;
  agentName: string;
  agentMessage: string;
  replyUrl: string;
}

interface EmailVerificationOTPData {
  userName: string;
  userEmail: string;
  otp: string;
  expiresMinutes: number;
}

class EmailService {
  private isInitialized: boolean = false;
  private fromEmail: string = '';

  constructor() {
    // Initialization is now explicit via initialize() method
  }

  public async initialize() {
    if (this.isInitialized) {
      logger.info('Email service already initialized');
      return;
    }
    try {
      if ((process.env.DISABLE_EMAIL || 'false').toLowerCase() === 'true') {
        logger.info('Email service explicitly disabled via DISABLE_EMAIL=true');
        return;
      }

      const apiKey = process.env.SENDGRID_API_KEY;
      const fromEmail = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SENDGRID_FROM_EMAIL;

      if (!apiKey) {
        logger.warn('SendGrid API key not configured (SENDGRID_API_KEY). Email service will be disabled.');
        return;
      }

      if (!fromEmail) {
        logger.warn('Sender email not configured. Set SENDGRID_FROM_EMAIL or GMAIL_USER. Email service will be disabled.');
        return;
      }

      sgMail.setApiKey(apiKey);
      this.fromEmail = fromEmail;
      this.isInitialized = true;
      logger.info('Email service initialized successfully with SendGrid');
    } catch (error: any) {
      logger.error('Email service initialization error', { error: error?.message });
      this.isInitialized = false;
    }
  }

  isServiceReady(): boolean {
    return this.isInitialized;
  }

  private async send(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    logger.info('Email system disabled manually. Would have sent email:', { to, subject });
    return true;
  }

  private generateBookingConfirmationHTML(data: BookingEmailData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation - Trek Tribe</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .booking-details { background: #f8f9fa; border-left: 4px solid #4a7c59; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .detail-label { font-weight: bold; color: #2d5a3d; }
          .highlight { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .footer { background: #2d5a3d; color: white; padding: 20px; text-align: center; font-size: 14px; }
          .button { background: #4a7c59; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌲 Trek Tribe</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Booking Confirmed!</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d5a3d;">Hello ${data.userName}! 👋</h2>
            <p>Great news! Your adventure booking has been confirmed. Get ready for an amazing experience!</p>
            
            <div class="booking-details">
              <h3 style="color: #2d5a3d; margin-top: 0;">🎒 Trip Details</h3>
              <div class="detail-row">
                <span class="detail-label">Adventure:</span>
                <span>${data.tripTitle}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Destination:</span>
                <span>📍 ${data.tripDestination}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Dates:</span>
                <span>📅 ${data.startDate} to ${data.endDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Travelers:</span>
                <span>👥 ${data.totalTravelers}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Total Amount:</span>
                <span>💰 ₹${data.totalAmount.toLocaleString()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Booking ID:</span>
                <span><strong>${data.bookingId}</strong></span>
              </div>
            </div>
            
            <div class="highlight">
              <h3 style="margin-top: 0; color: #2d5a3d;">🗺️ Your Trip Organizer</h3>
              <p><strong>${data.organizerName}</strong></p>
              <p>📧 ${data.organizerEmail}</p>
              <p>📞 ${data.organizerPhone}</p>
            </div>
            
            <h3 style="color: #2d5a3d;">📝 Important Information:</h3>
            <ul>
              <li>Save your <strong>Booking ID: ${data.bookingId}</strong> for future reference</li>
              <li>You will receive further trip details and updates via email and WhatsApp</li>
              <li>Contact your organizer for any specific questions about the trip</li>
              <li>Check your WhatsApp for additional trip updates and group invitations</li>
              <li>Prepare your documents and equipment as per the itinerary</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <p style="font-size: 18px; color: #2d5a3d;"><strong>Have an amazing adventure! 🎉</strong></p>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>Trek Tribe</strong> - Your Adventure Awaits</p>
            <p style="font-size: 12px; margin: 10px 0 0 0;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetHTML(data: PasswordResetData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Your Password - Trek Tribe</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { background: #4a7c59; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .button:hover { background: #2d5a3d; }
          .security-notice { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { background: #2d5a3d; color: white; padding: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌲 Trek Tribe</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Password Reset Request</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d5a3d;">Hello ${data.userName}!</h2>
            <p>We received a request to reset your password for your Trek Tribe account.</p>
            <p>Click the button below to create a new password:</p>
            
            <div style="text-align: center;">
              <a href="${data.resetUrl}" class="button">🔐 Reset My Password</a>
            </div>
            
            <div class="security-notice">
              <h4 style="margin-top: 0;">🔒 Security Notice:</h4>
              <ul style="margin-bottom: 0;">
                <li>This link will expire in 1 hour for your security</li>
                <li>If you didn't request this reset, you can safely ignore this email</li>
                <li>Never share this link with anyone</li>
              </ul>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              If the button doesn't work, you can copy and paste this link into your browser:<br>
              <a href="${data.resetUrl}" style="word-break: break-all;">${data.resetUrl}</a>
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Trek Tribe</strong> - Secure Adventures</p>
            <p style="font-size: 12px;">This is an automated security message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateTripUpdateHTML(data: TripUpdateData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Trip Update - Trek Tribe</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .update-box { background: #e8f4fd; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .footer { background: #2d5a3d; color: white; padding: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌲 Trek Tribe</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Trip Update</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d5a3d;">Hello ${data.userName}!</h2>
            <p>We have an important update about your upcoming trip: <strong>${data.tripTitle}</strong></p>
            
            <div class="update-box">
              <h3 style="color: #007bff; margin-top: 0;">📢 Update Details:</h3>
              <p style="margin-bottom: 0;">${data.updateMessage}</p>
            </div>
            
            <p>If you have any questions about this update, please contact your trip organizer:</p>
            <p><strong>Organizer:</strong> ${data.organizerName}</p>
            
            <p>We appreciate your understanding and look forward to your amazing adventure!</p>
          </div>
          
          <div class="footer">
            <p><strong>Trek Tribe</strong> - Keeping You Informed</p>
            <p style="font-size: 12px;">This is an automated update message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentScreenshotHTML(data: PaymentScreenshotData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Screenshot - TrekTribe</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .payment-box { background: #e8f5e8; border-left: 4px solid #4a7c59; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .screenshot-box { background: #f8f9fa; border: 2px dashed #4a7c59; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
          .footer { background: #2d5a3d; color: white; padding: 20px; text-align: center; font-size: 14px; }
          .btn { display: inline-block; background: #4a7c59; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏔️ TrekTribe</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">New Payment Screenshot</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d5a3d;">Hello ${data.organizerName}!</h2>
            <p>A traveler has uploaded a payment screenshot for your trip: <strong>${data.tripTitle}</strong></p>
            
            <div class="payment-box">
              <h3 style="color: #4a7c59; margin-top: 0;">💰 Payment Details:</h3>
              <p><strong>Traveler:</strong> ${data.travelerName}</p>
              <p><strong>Email:</strong> ${data.travelerEmail}</p>
              <p><strong>Booking ID:</strong> ${data.bookingId}</p>
              <p><strong>Amount:</strong> ₹${data.totalAmount.toLocaleString()}</p>
            </div>
            
            <div class="screenshot-box">
              <h3 style="color: #4a7c59; margin-top: 0;">📸 Payment Screenshot</h3>
              <p>The traveler has uploaded a payment screenshot for verification.</p>
              <p><em>Please check your TrekTribe dashboard to view and verify the payment.</em></p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://trektribe.com'}/dashboard/bookings" class="btn">
                View Booking Dashboard
              </a>
            </div>
            
            <p>Please verify the payment and update the booking status accordingly. If you have any questions, you can contact the traveler directly.</p>
          </div>
          
          <div class="footer">
            <p><strong>TrekTribe</strong> - Payment Notification</p>
            <p style="font-size: 12px;">This is an automated notification message.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
    const html = this.generateBookingConfirmationHTML(data);
    const result = await this.send(
      data.userEmail,
      `🎯 Booking Confirmed - ${data.tripTitle}`,
      html,
      `Hello ${data.userName}!\n\nYour booking for ${data.tripTitle} has been confirmed!\n\nBooking ID: ${data.bookingId}\n\nTrek Tribe Team`
    );
    if (result) logger.info('Booking confirmation email sent', { userEmail: data.userEmail, bookingId: data.bookingId });
    return result;
  }

  async sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
    const html = this.generatePasswordResetHTML(data);
    const result = await this.send(
      data.userEmail,
      '🔐 Reset Your Trek Tribe Password',
      html,
      `Hello ${data.userName}!\n\nReset your password: ${data.resetUrl}\n\nThis link expires in 1 hour.\n\nTrek Tribe Security Team`
    );
    if (result) logger.info('Password reset email sent', { userEmail: data.userEmail });
    return result;
  }

  async sendTripUpdateEmail(data: TripUpdateData): Promise<boolean> {
    const html = this.generateTripUpdateHTML(data);
    const result = await this.send(data.userEmail, `📢 Update: ${data.tripTitle}`, html);
    if (result) logger.info('Trip update email sent', { userEmail: data.userEmail });
    return result;
  }

  async sendPaymentScreenshotNotification(data: PaymentScreenshotData): Promise<boolean> {
    const html = this.generatePaymentScreenshotHTML(data);
    const result = await this.send(data.organizerEmail, `💰 New Payment Screenshot - ${data.tripTitle}`, html);
    if (result) logger.info('Payment screenshot notification sent', { organizerEmail: data.organizerEmail });
    return result;
  }

  private generateEmailVerificationOTPHTML(data: EmailVerificationOTPData): string {
    return `
      <!DOCTYPE html>
      <html lang=\"en\">
      <head>
        <meta charset=\"UTF-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
        <title>Your Verification Code - Trek Tribe</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 560px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 6px 24px rgba(0,0,0,0.08); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: #fff; padding: 24px; text-align: center; }
          .content { padding: 24px; color: #333; }
          .otp { font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #2d5a3d; text-align: center; padding: 16px; border: 2px dashed #4a7c59; border-radius: 8px; margin: 16px 0; }
          .meta { text-align: center; color: #666; }
          .footer { background: #2d5a3d; color: #fff; padding: 16px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class=\"container\">
          <div class=\"header\">
            <h1>🌲 Trek Tribe</h1>
            <p>Email Verification</p>
          </div>
          <div class=\"content\">
            <p>Hi ${data.userName || 'there'},</p>
            <p>Use the verification code below to verify your email address:</p>
            <div class=\"otp\">${data.otp}</div>
            <p class=\"meta\">This code will expire in ${data.expiresMinutes} minutes.</p>
            <p class=\"meta\">If you did not request this, you can safely ignore this email.</p>
          </div>
          <div class=\"footer\">Trek Tribe • Secure Verification</div>
        </div>
      </body>
      </html>
    `;
  }

  async sendEmailVerificationOTP(data: EmailVerificationOTPData): Promise<boolean> {
    const html = this.generateEmailVerificationOTPHTML(data);
    const result = await this.send(
      data.userEmail,
      'Your Trek Tribe verification code',
      html,
      `Your Trek Tribe verification code is ${data.otp}. It expires in ${data.expiresMinutes} minutes.`
    );
    if (result) logger.info('Email verification OTP sent', { userEmail: data.userEmail });
    return result;
  }

  async sendEmail(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    return this.send(options.to, options.subject, options.html, options.text);
  }

  async testConnection(): Promise<boolean> {
    return this.isInitialized;
  }

  private generateAgentReplyHTML(data: AgentReplyData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Agent Reply - Trek Tribe Support</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2d5a3d, #4a7c59); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 28px; }
          .content { padding: 30px; }
          .agent-reply { background: #e8f4fd; border-left: 4px solid #007bff; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .ticket-info { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .button { background: #4a7c59; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0; }
          .footer { background: #2d5a3d; color: white; padding: 20px; text-align: center; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌲 Trek Tribe Support</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">New Agent Reply</p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d5a3d;">Hello ${data.userName}! 👋</h2>
            <p>Great news! Our support agent <strong>${data.agentName}</strong> has replied to your support ticket.</p>
            
            <div class="ticket-info">
              <h3 style="color: #2d5a3d; margin-top: 0;">🎫 Ticket Details</h3>
              <p><strong>Ticket ID:</strong> ${data.ticketId}</p>
              <p><strong>Subject:</strong> ${data.ticketSubject}</p>
              <p><strong>Agent:</strong> ${data.agentName}</p>
            </div>
            
            <div class="agent-reply">
              <h3 style="color: #007bff; margin-top: 0;">💬 Agent Reply:</h3>
              <p style="margin-bottom: 0;">${data.agentMessage}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.replyUrl}" class="button">
                💬 Reply to Agent
              </a>
            </div>
            
            <p>You can reply directly through our support portal or via email. We're here to help with any questions!</p>
            
            <h3 style="color: #2d5a3d;">📞 Need immediate help?</h3>
            <p>📧 Email: trektribeagent@gmail.com<br>
               📱 Phone: 9876177839</p>
          </div>
          
          <div class="footer">
            <p><strong>Trek Tribe</strong> - Always Here to Help</p>
            <p style="font-size: 12px; margin: 10px 0 0 0;">
              This is an automated message from Trek Tribe support system.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendAgentReplyNotification(data: AgentReplyData): Promise<boolean> {
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping agent reply notification');
      return false;
    }

    const html = this.generateAgentReplyHTML(data);
    const result = await this.send(
      data.userEmail,
      `🎧 Agent Reply - ${data.ticketSubject} [${data.ticketId}]`,
      html,
      `Hello ${data.userName}!\n\nOur support agent ${data.agentName} has replied to your ticket.\n\nTicket ID: ${data.ticketId}\nAgent Reply:\n${data.agentMessage}\n\nReply here: ${data.replyUrl}\n\nTrek Tribe Support Team`
    );
    if (result) logger.info('Agent reply notification email sent', { userEmail: data.userEmail, ticketId: data.ticketId });
    return result;
  }

  async sendTicketResolvedNotification(data: { userName: string; userEmail: string; ticketId: string; resolutionNote?: string; }): Promise<boolean> {
    return this.send(
      data.userEmail,
      `✅ Your support ticket ${data.ticketId} has been resolved`,
      `<p>Hello ${data.userName},</p><p>Your support ticket <strong>${data.ticketId}</strong> has been resolved.</p><p>${data.resolutionNote || 'Resolved by support agent.'}</p><p>Trek Tribe Support Team</p>`,
      `Hello ${data.userName},\n\nYour support ticket ${data.ticketId} has been resolved.\n\n${data.resolutionNote || 'Resolved by support agent.'}\n\nTrek Tribe Support Team`
    );
  }

  async getServiceStatus() {
    return {
      isReady: this.isServiceReady(),
      hasCredentials: !!process.env.SENDGRID_API_KEY,
      provider: 'sendgrid'
    };
  }
}

// Export singleton instance
export const emailService = new EmailService();
export { EmailService };
