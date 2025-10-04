import nodemailer from 'nodemailer';

export interface EmailConfig {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (emailUser && 
        emailPassword && 
        emailUser.includes('@') && 
        !emailUser.includes('your-email') &&
        emailPassword.length > 5) {
      try {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: emailUser,
            pass: emailPassword
          }
        });
        this.isConfigured = true;
        console.log('✅ Email Service (Gmail) initialized successfully');
      } catch (error) {
        console.warn('⚠️  Email Service disabled: Failed to initialize Gmail transport');
        this.isConfigured = false;
      }
    } else {
      console.warn('⚠️  Email Service disabled: Gmail credentials not configured properly');
      this.isConfigured = false;
    }
  }

  async sendEmail(config: EmailConfig): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.warn('Email service not configured - skipping email send');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Trek Tribe" <${process.env.EMAIL_USER}>`,
        to: config.to,
        subject: config.subject,
        text: config.text,
        html: config.html
      });

      console.log('Email sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendOTPEmail(email: string, otp: string, purpose: string): Promise<boolean> {
    const subject = `Trek Tribe - Your OTP for ${purpose}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2D5A3D 0%, #4A7C59 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🏔️ Trek Tribe</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Adventure Awaits</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2D5A3D; margin-bottom: 20px;">Verification Code</h2>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Hello! Your OTP for <strong>${purpose}</strong> is:
          </p>
          
          <div style="background: #fff; border: 2px solid #2D5A3D; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <div style="font-size: 32px; font-weight: bold; color: #2D5A3D; letter-spacing: 8px; font-family: monospace;">
              ${otp}
            </div>
          </div>
          
          <p style="font-size: 14px; color: #666; line-height: 1.6;">
            <strong>Important:</strong><br>
            • This OTP is valid for 10 minutes only<br>
            • Do not share this code with anyone<br>
            • If you didn't request this, please ignore this email
          </p>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="font-size: 12px; color: #999;">
              Happy Trekking! 🥾⛰️<br>
              The Trek Tribe Team
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `
      Trek Tribe - Verification Code
      
      Your OTP for ${purpose}: ${otp}
      
      This code is valid for 10 minutes only.
      Do not share this code with anyone.
      
      Happy Trekking!
      Trek Tribe Team
    `;

    return this.sendEmail({
      from: process.env.EMAIL_USER || '',
      to: email,
      subject,
      text,
      html
    });
  }

  async sendBookingConfirmationEmail(
    email: string, 
    bookingData: any, 
    tripData: any
  ): Promise<boolean> {
    const subject = `Booking Confirmed - ${tripData.title}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2D5A3D 0%, #4A7C59 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🏔️ Trek Tribe</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Booking Confirmed!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <strong>✅ Your adventure is confirmed!</strong>
          </div>
          
          <h2 style="color: #2D5A3D; margin-bottom: 20px;">${tripData.title}</h2>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Booking ID:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${bookingData.bookingId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Destination:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${tripData.destination}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Start Date:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${new Date(tripData.startDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>End Date:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${new Date(tripData.endDate).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Participants:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${bookingData.participants}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Amount Paid:</strong></td>
                <td style="padding: 8px 0; text-align: right; color: #28a745; font-weight: bold;">₹${bookingData.amount}</td>
              </tr>
            </table>
          </div>
          
          ${bookingData.paymentType === 'advance' ? `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
              <strong>⚠️ Balance Payment Required</strong><br>
              You have paid an advance of ₹${bookingData.amount}. 
              Balance ₹${(tripData.price * bookingData.participants) - bookingData.amount} is due before the trip starts.
            </div>
          ` : ''}
          
          <div style="background: #d1ecf1; border: 1px solid #b8daff; color: #004085; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <strong>📋 What's Next?</strong><br>
            • You'll receive trip details and packing list 7 days before departure<br>
            • Emergency contact information will be shared<br>
            • Weather updates will be provided closer to the date<br>
            • Join our WhatsApp group for real-time updates
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="font-size: 14px; color: #666;">
              Need help? Contact us at support@trekktribe.com<br>
              or call +91-XXXXX-XXXXX
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 15px;">
              Happy Trekking! 🥾⛰️<br>
              The Trek Tribe Team
            </p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      from: process.env.EMAIL_USER || '',
      to: email,
      subject,
      html
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const subject = 'Welcome to Trek Tribe - Your Adventure Begins! 🏔️';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #2D5A3D 0%, #4A7C59 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🏔️ Welcome to Trek Tribe</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Adventure Community</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #2D5A3D; margin-bottom: 20px;">Hello ${name}! 🎉</h2>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Welcome to the Trek Tribe family! We're thrilled to have you join our community of adventure enthusiasts and nature lovers.
          </p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2D5A3D; margin-bottom: 15px;">🌟 What You Can Do Now:</h3>
            <ul style="color: #333; line-height: 1.8;">
              <li>🔍 Browse amazing adventures across 47+ countries</li>
              <li>📚 Read authentic reviews from fellow trekkers</li>
              <li>❤️ Save your favorite trips to your wishlist</li>
              <li>👥 Connect with like-minded adventure enthusiasts</li>
              <li>📱 Book trips with our easy payment options</li>
            </ul>
          </div>
          
          <div style="background: #e8f5e8; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #2D5A3D; margin-bottom: 15px;">🏆 Our Promise:</h3>
            <ul style="color: #333; line-height: 1.8; list-style: none; padding-left: 0;">
              <li>🛡️ 100% Safety record with certified guides</li>
              <li>🌱 Carbon-neutral adventures</li>
              <li>🤝 Supporting local communities</li>
              <li>⭐ 98.4% satisfaction rate</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/trips" 
               style="background: #4A7C59; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
              🌿 Start Exploring Adventures
            </a>
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="font-size: 14px; color: #666;">
              Need help getting started? Our support team is here for you!<br>
              📧 support@trekktribe.com | 📞 +91-XXXXX-XXXXX
            </p>
            <p style="font-size: 12px; color: #999; margin-top: 15px;">
              Happy Trekking! 🥾⛰️<br>
              The Trek Tribe Team
            </p>
          </div>
        </div>
      </div>
    `;

    return this.sendEmail({
      from: process.env.EMAIL_USER || '',
      to: email,
      subject,
      html
    });
  }
}

export const emailService = new EmailService();