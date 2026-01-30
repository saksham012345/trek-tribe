import nodemailer from 'nodemailer';
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
  private transporter: nodemailer.Transporter | null = null;
  private isInitialized: boolean = false;
  private initializationError: string | null = null;
  private configSource: string | null = null;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      // Allow disabling email initialization explicitly to avoid noisy logs
      if ((process.env.DISABLE_EMAIL || 'false').toLowerCase() === 'true') {
        logger.info('Email service explicitly disabled via DISABLE_EMAIL=true');
        this.configSource = 'disabled';
        return;
      }
      // Require credentials from environment
      const emailUser = process.env.GMAIL_USER || process.env.EMAIL_USER;
      const emailPassword = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD;

      if (!emailUser || !emailPassword) {
        logger.warn('Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD). Email service will be disabled.');
        this.initializationError = 'Missing credentials (GMAIL_USER or EMAIL_USER)';
        this.configSource = 'missing_credentials';
        return;
      }

      this.configSource = process.env.GMAIL_USER ? 'GMAIL_USER' : 'EMAIL_USER';

      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verify the connection
      try {
        await this.transporter.verify();
        this.isInitialized = true;
        this.initializationError = null;
        logger.info('Email service initialized successfully with Gmail SMTP');
      } catch (verifyError: any) {
        // Treat verification failures as non-fatal: log a concise warning and
        // disable the email service so application continues running.
        const errorMessage = verifyError?.message || 'Unknown verification error';
        logger.warn('Email service disabled: SMTP verification failed.', { error: errorMessage });
        this.initializationError = `SMTP Verification failed: ${errorMessage}`;
        this.transporter = null;
        this.isInitialized = false;
      }

    } catch (error: any) {
      // For unexpected errors during initialization, warn and disable the service
      const errorMsg = error?.message || 'Unknown error';
      logger.error('❌ Email service initialization FATAL error', {
        error: errorMsg,
        stack: error?.stack,
        code: error?.code
      });
      this.initializationError = `Fatal init error: ${errorMsg}`;
      this.transporter = null;
      this.isInitialized = false;
    }
  }

  isServiceReady(): boolean {
    return this.isInitialized && this.transporter !== null;
  }

  private async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('Email service connection test failed', { error: error?.message });
      return false;
    }
  }

  async getServiceStatus() {
    const hasGmailUser = !!process.env.GMAIL_USER;
    const hasEmailUser = !!process.env.EMAIL_USER;
    const hasGmailPass = !!process.env.GMAIL_APP_PASSWORD;
    const hasEmailPass = !!process.env.EMAIL_PASSWORD;

    return {
      isReady: this.isServiceReady(),
      configSource: this.configSource,
      hasCredentials: (hasGmailUser || hasEmailUser) && (hasGmailPass || hasEmailPass),
      credentialDetails: {
        hasGmailUser,
        hasEmailUser,
        hasGmailPass,
        hasEmailPass
      },
      initializationError: this.initializationError,
      lastTest: this.isServiceReady() ? await this.testConnection() : false
    };
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
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping booking confirmation email');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Trek Tribe" <${process.env.GMAIL_USER}>`,
        to: data.userEmail,
        cc: data.organizerEmail,
        subject: `🎯 Booking Confirmed - ${data.tripTitle}`,
        html: this.generateBookingConfirmationHTML(data),
        text: `Hello ${data.userName}!\n\nYour booking for ${data.tripTitle} has been confirmed!\n\nBooking Details:\n- Trip: ${data.tripTitle}\n- Destination: ${data.tripDestination}\n- Dates: ${data.startDate} to ${data.endDate}\n- Travelers: ${data.totalTravelers}\n- Total: ₹${data.totalAmount}\n- Booking ID: ${data.bookingId}\n\nOrganizer: ${data.organizerName}\nContact: ${data.organizerPhone}\n\nHave an amazing adventure!\nTrek Tribe Team`
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Booking confirmation email sent successfully', {
        userEmail: data.userEmail,
        bookingId: data.bookingId
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send booking confirmation email', {
        error: error.message,
        userEmail: data.userEmail
      });
      return false;
    }
  }

  async sendPasswordResetEmail(data: PasswordResetData): Promise<boolean> {
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping password reset email');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Trek Tribe Security" <${process.env.GMAIL_USER}>`,
        to: data.userEmail,
        subject: '🔐 Reset Your Trek Tribe Password',
        html: this.generatePasswordResetHTML(data),
        text: `Hello ${data.userName}!\n\nYou requested to reset your password for Trek Tribe.\n\nClick this link to reset your password: ${data.resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nTrek Tribe Security Team`
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Password reset email sent successfully', {
        userEmail: data.userEmail
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send password reset email', {
        error: error.message,
        userEmail: data.userEmail
      });
      return false;
    }
  }

  async sendTripUpdateEmail(data: TripUpdateData): Promise<boolean> {
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping trip update email');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Trek Tribe Updates" <${process.env.GMAIL_USER}>`,
        to: data.userEmail,
        subject: `📢 Update: ${data.tripTitle}`,
        html: this.generateTripUpdateHTML(data),
        text: `Hello ${data.userName}!\n\nTrip Update for: ${data.tripTitle}\n\n${data.updateMessage}\n\nOrganizer: ${data.organizerName}\n\nTrek Tribe Team`
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Trip update email sent successfully', {
        userEmail: data.userEmail,
        tripTitle: data.tripTitle
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send trip update email', {
        error: error.message,
        userEmail: data.userEmail
      });
      return false;
    }
  }

  async sendPaymentScreenshotNotification(data: PaymentScreenshotData): Promise<boolean> {
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping payment screenshot notification');
      return false;
    }

    try {
      const mailOptions = {
        from: `\"TrekTribe Payment Updates\" <${process.env.GMAIL_USER}>`,
        to: data.organizerEmail,
        subject: `💰 New Payment Screenshot - ${data.tripTitle}`,
        html: this.generatePaymentScreenshotHTML(data),
        text: `Hello ${data.organizerName}!\n\nA new payment screenshot has been uploaded for your trip: ${data.tripTitle}\n\nTraveler: ${data.travelerName} (${data.travelerEmail})\nBooking ID: ${data.bookingId}\nAmount: ₹${data.totalAmount.toLocaleString()}\n\nPlease verify the payment in your TrekTribe dashboard.\n\nTrekTribe Team`
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Payment screenshot notification sent successfully', {
        organizerEmail: data.organizerEmail,
        tripTitle: data.tripTitle,
        bookingId: data.bookingId
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send payment screenshot notification', {
        error: error.message,
        organizerEmail: data.organizerEmail
      });
      return false;
    }
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
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping email verification OTP');
      return false;
    }

    try {
      const mailOptions = {
        from: `\"Trek Tribe Verification\" <${process.env.GMAIL_USER}>`,
        to: data.userEmail,
        subject: 'Your Trek Tribe verification code',
        html: this.generateEmailVerificationOTPHTML(data),
        text: `Your Trek Tribe verification code is ${data.otp}. It expires in ${data.expiresMinutes} minutes.`
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Email verification OTP sent', { userEmail: data.userEmail });
      return true;
    } catch (error: any) {
      logger.error('Failed to send email verification OTP', { error: error.message, userEmail: data.userEmail });
      return false;
    }
  }

  /**
   * Generic email sending method
   */
  async sendEmail(options: { to: string; subject: string; html: string; text?: string }): Promise<boolean> {
    if (!this.isServiceReady()) {
      logger.warn('Email service not ready, skipping email send');
      return false;
    }

    try {
      const mailOptions = {
        from: `"Trek Tribe" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, '') // Strip HTML if no text provided
      };

      await this.transporter!.sendMail(mailOptions);
      logger.info('Generic email sent successfully', { to: options.to, subject: options.subject });
      return true;
    } catch (error: any) {
      logger.error('Failed to send generic email', { error: error.message, to: options.to });
      return false;
    }
  }
}


// Export singleton instance
export const emailService = new EmailService();
export { EmailService };
