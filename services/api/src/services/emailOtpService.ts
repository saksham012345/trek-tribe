import sgMail from '@sendgrid/mail';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface SendOTPResult {
  success: boolean;
  message: string;
  error?: string;
}

class EmailOTPService {
  private isReady: boolean = false;
  private fromEmail: string = '';

  constructor() {
    this.init();
  }

  private init() {
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.GMAIL_USER || process.env.EMAIL_USER || process.env.SENDGRID_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.warn('⚠️ Email OTP service not configured. Set SENDGRID_API_KEY and GMAIL_USER (or SENDGRID_FROM_EMAIL)');
      return;
    }

    sgMail.setApiKey(apiKey);
    this.fromEmail = fromEmail;
    this.isReady = true;
    console.log('✅ Email OTP service initialized with SendGrid');
  }

  /**
   * Generate and send OTP to user's email
   */
  async sendOTP(email: string, purpose: 'registration' | 'login' | 'reset' = 'registration'): Promise<SendOTPResult> {
    try {
      if (!this.isReady) {
        return { success: false, message: 'Email service not configured', error: 'SendGrid not initialized' };
      }

      const user = await User.findOne({ email });
      if (!user && purpose !== 'registration') {
        return { success: false, message: 'User not found', error: 'USER_NOT_FOUND' };
      }

      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = await bcrypt.hash(otp, 10);
      const expiryTime = new Date(Date.now() + 5 * 60 * 1000);

      if (user) {
        user.emailVerificationOtpHash = otpHash;
        user.emailVerificationExpires = expiryTime;
        user.emailVerificationAttempts = (user.emailVerificationAttempts || 0);
        await user.save();
      }

      await sgMail.send({
        to: email,
        from: { email: this.fromEmail, name: 'Trek Tribe' },
        subject: this.getEmailSubject(purpose),
        html: this.getEmailTemplate(otp, purpose),
        text: `Your Trek Tribe OTP is: ${otp}. It expires in 5 minutes.`
      });

      console.log(`✅ OTP sent to ${email} for ${purpose}`);

      return {
        success: true,
        message: 'OTP sent successfully',
        ...(process.env.NODE_ENV === 'development' && { otp })
      } as any;

    } catch (error: any) {
      const detail = error?.response?.body?.errors?.[0]?.message || error.message;
      console.error('❌ Failed to send OTP:', detail);
      return { success: false, message: 'Failed to send OTP', error: detail };
    }
  }

  /**
   * Verify OTP entered by user
   */
  async verifyOTP(email: string, otp: string): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      // Check if OTP exists
      if (!user.emailVerificationOtpHash) {
        return {
          success: false,
          message: 'No OTP found. Please request a new OTP.'
        };
      }

      // Check if OTP has expired
      if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
        return {
          success: false,
          message: 'OTP has expired. Please request a new OTP.'
        };
      }

      // Check attempt limit (max 5 attempts)
      if (user.emailVerificationAttempts && user.emailVerificationAttempts >= 5) {
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Verify OTP
      const isValid = await bcrypt.compare(otp, user.emailVerificationOtpHash);

      if (!isValid) {
        // Increment failed attempts
        user.emailVerificationAttempts = (user.emailVerificationAttempts || 0) + 1;
        await user.save();

        return {
          success: false,
          message: 'Invalid OTP. Please try again.'
        };
      }

      // OTP is valid - mark email as verified
      user.emailVerified = true;
      user.emailVerificationOtpHash = undefined;
      user.emailVerificationExpires = undefined;
      user.emailVerificationAttempts = 0;
      await user.save();

      return {
        success: true,
        message: 'Email verified successfully',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      };

    } catch (error: any) {
      console.error('❌ Error verifying OTP:', error.message);
      return {
        success: false,
        message: 'Failed to verify OTP'
      };
    }
  }

  /**
   * Resend OTP (with rate limiting check)
   */
  async resendOTP(email: string, purpose: 'registration' | 'login' | 'reset' = 'registration'): Promise<SendOTPResult> {
    try {
      const user = await User.findOne({ email });

      if (!user && purpose !== 'registration') {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check rate limiting (1 minute between resends)
      if (user?.emailVerificationExpires) {
        const lastSent = user.emailVerificationExpires.getTime() - (5 * 1000 * 60);
        const timeSinceLastSend = Date.now() - lastSent;
        const waitTime = 60 * 1000; // 1 minute

        if (timeSinceLastSend < waitTime) {
          const remainingSeconds = Math.ceil((waitTime - timeSinceLastSend) / 1000);
          return {
            success: false,
            message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
            error: 'RATE_LIMIT'
          };
        }
      }

      // Send new OTP
      return await this.sendOTP(email, purpose);

    } catch (error: any) {
      console.error('❌ Error resending OTP:', error.message);
      return {
        success: false,
        message: 'Failed to resend OTP',
        error: error.message
      };
    }
  }

  private getEmailSubject(purpose: string): string {
    switch (purpose) {
      case 'registration':
        return 'Verify Your Email - Trek Tribe';
      case 'login':
        return 'Login Verification Code - Trek Tribe';
      case 'reset':
        return 'Password Reset Code - Trek Tribe';
      default:
        return 'Verification Code - Trek Tribe';
    }
  }

  private getEmailTemplate(otp: string, purpose: string): string {
    const purposeText = purpose === 'registration'
      ? 'complete your registration'
      : purpose === 'login'
        ? 'log in to your account'
        : 'reset your password';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border: 1px solid #e0e0e0;
          }
          .otp-box {
            background: white;
            border: 2px dashed #667eea;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            border-radius: 8px;
          }
          .otp-code {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            letter-spacing: 8px;
          }
          .footer {
            background: #333;
            color: white;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            border-radius: 0 0 10px 10px;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 12px;
            margin: 15px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏔️ Trek Tribe</h1>
          <p>Your Adventure Awaits</p>
        </div>
        
        <div class="content">
          <h2>Email Verification</h2>
          <p>Hello,</p>
          <p>Use the following One-Time Password (OTP) to ${purposeText}:</p>
          
          <div class="otp-box">
            <div class="otp-code">${otp}</div>
            <p style="margin-top: 10px; color: #666;">This code expires in 5 minutes</p>
          </div>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> Never share this code with anyone. Trek Tribe will never ask for your OTP.
          </div>
          
          <p>If you didn't request this code, please ignore this email or contact our support team.</p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Trek Tribe. All rights reserved.</p>
          <p>This is an automated message, please do not reply.</p>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailOtpService = new EmailOTPService();
