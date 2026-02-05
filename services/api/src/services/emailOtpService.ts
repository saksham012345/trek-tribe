import nodemailer from 'nodemailer';
import { User } from '../models/User';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface SendOTPResult {
  success: boolean;
  message: string;
  error?: string;
}

class EmailOTPService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Lazy initialization - don't initialize in constructor to avoid env var issues
  }

  private ensureInitialized() {
    if (this.transporter) return;

    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      console.warn('⚠️ Email OTP service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPassword,
        },
      });

      console.log('✅ Email OTP service initialized');
    } catch (error: any) {
      console.error('❌ Failed to initialize email OTP service:', error.message);
    }
  }

  /**
   * Generate and send OTP to user's email
   */
  async sendOTP(email: string, purpose: 'registration' | 'login' | 'reset' = 'registration'): Promise<SendOTPResult> {
    try {
      this.ensureInitialized();

      if (!this.transporter) {
        return {
          success: false,
          message: 'Email service not configured',
          error: 'SMTP transport not initialized'
        };
      }

      // Find user by email
      const user = await User.findOne({ email });
      if (!user && purpose !== 'registration') {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Generate 6-digit OTP
      const otp = String(crypto.randomInt(100000, 999999));
      const otpHash = await bcrypt.hash(otp, 10);

      // Store OTP with 5-minute expiry
      const expiryTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      if (user) {
        user.emailVerificationOtp = otpHash;
        user.emailVerificationExpiry = expiryTime;
        user.emailVerificationAttempts = (user.emailVerificationAttempts || 0);
        await user.save();
      }

      // Prepare email content based on purpose
      const subject = this.getEmailSubject(purpose);
      const htmlContent = this.getEmailTemplate(otp, purpose);

      // Send email
      await this.transporter.sendMail({
        from: `Trek Tribe <${process.env.GMAIL_USER}>`,
        to: email,
        subject,
        html: htmlContent,
      });

      console.log(`✅ OTP sent to ${email} for ${purpose}`);

      return {
        success: true,
        message: 'OTP sent successfully',
        // Include OTP in development mode for testing
        ...(process.env.NODE_ENV === 'development' && { otp })
      } as any;

    } catch (error: any) {
      console.error('❌ Failed to send OTP:', error.message);
      return {
        success: false,
        message: 'Failed to send OTP',
        error: error.message
      };
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
      if (!user.emailVerificationOtp) {
        return {
          success: false,
          message: 'No OTP found. Please request a new OTP.'
        };
      }

      // Check if OTP has expired
      if (!user.emailVerificationExpiry || user.emailVerificationExpiry < new Date()) {
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
      const isValid = await bcrypt.compare(otp, user.emailVerificationOtp);

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
      user.emailVerificationOtp = undefined;
      user.emailVerificationExpiry = undefined;
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
      this.ensureInitialized();

      const user = await User.findOne({ email });

      if (!user && purpose !== 'registration') {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Check rate limiting (1 minute between resends)
      if (user?.emailVerificationExpiry) {
        const lastSent = user.emailVerificationExpiry.getTime() - (5 * 60 * 1000);
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
