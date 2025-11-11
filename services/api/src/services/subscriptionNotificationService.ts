import { emailService } from './emailService';
import CRMSubscription from '../models/CRMSubscription';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { SUBSCRIPTION_PLANS } from './razorpayService';

interface TrialNotificationData {
  organizerName: string;
  organizerEmail: string;
  trialEndDate: Date;
  daysRemaining: number;
  subscriptionPlans: typeof SUBSCRIPTION_PLANS;
}

class SubscriptionNotificationService {
  /**
   * Send trial ending in 7 days reminder
   */
  async sendTrialEndingIn7DaysEmail(data: TrialNotificationData): Promise<boolean> {
    try {
      const subject = '⏰ Your TrekTribe Trial Ends in 7 Days!';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .warning-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .plan-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .plan-name { font-size: 20px; font-weight: bold; color: #667eea; margin-bottom: 10px; }
    .plan-price { font-size: 32px; font-weight: bold; color: #1f2937; }
    .plan-features { list-style: none; padding: 0; margin: 15px 0; }
    .plan-features li { padding: 5px 0; }
    .plan-features li:before { content: "✓ "; color: #10b981; font-weight: bold; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Your Trial is Ending Soon!</h1>
    </div>
    <div class="content">
      <p>Hi ${data.organizerName},</p>
      
      <div class="warning-box">
        <strong>⏰ Important Reminder:</strong> Your 2-month free trial ends in <strong>${data.daysRemaining} days</strong> on <strong>${data.trialEndDate.toLocaleDateString('en-IN')}</strong>.
      </div>
      
      <p>To continue listing trips and growing your travel business, choose a subscription plan that fits your needs:</p>
      
      <h2 style="color: #1f2937; margin-top: 30px;">📦 Choose Your Plan</h2>
      
      <div class="plan-card">
        <div class="plan-name">🌱 Starter Pack</div>
        <div class="plan-price">${SUBSCRIPTION_PLANS['5_trips'].priceDisplay}</div>
        <p style="color: #6b7280; font-size: 14px;">${SUBSCRIPTION_PLANS['5_trips'].description}</p>
        <ul class="plan-features">
          ${SUBSCRIPTION_PLANS['5_trips'].features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      
      <div class="plan-card" style="border: 2px solid #667eea;">
        <div style="background: #667eea; color: white; padding: 5px 15px; border-radius: 4px; display: inline-block; font-size: 12px; margin-bottom: 10px;">🌟 MOST POPULAR</div>
        <div class="plan-name">🚀 Growth Pack</div>
        <div class="plan-price">${SUBSCRIPTION_PLANS['10_trips'].priceDisplay}</div>
        <p style="color: #6b7280; font-size: 14px;">${SUBSCRIPTION_PLANS['10_trips'].description}</p>
        <ul class="plan-features">
          ${SUBSCRIPTION_PLANS['10_trips'].features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      
      <div class="plan-card">
        <div class="plan-name">💼 Professional Pack</div>
        <div class="plan-price">${SUBSCRIPTION_PLANS['20_trips'].priceDisplay}</div>
        <p style="color: #6b7280; font-size: 14px;">${SUBSCRIPTION_PLANS['20_trips'].description}</p>
        <ul class="plan-features">
          ${SUBSCRIPTION_PLANS['20_trips'].features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      
      <div class="plan-card">
        <div class="plan-name">🏢 Enterprise Pack</div>
        <div class="plan-price">${SUBSCRIPTION_PLANS['50_trips'].priceDisplay}</div>
        <p style="color: #6b7280; font-size: 14px;">${SUBSCRIPTION_PLANS['50_trips'].description}</p>
        <ul class="plan-features">
          ${SUBSCRIPTION_PLANS['50_trips'].features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/subscription/plans" class="cta-button">
          Choose Your Plan Now →
        </a>
      </div>
      
      <p style="margin-top: 30px;"><strong>💰 Save More with Larger Packs:</strong></p>
      <ul>
        <li>Growth Pack: Save 15% compared to Starter</li>
        <li>Professional Pack: Save 25% compared to Starter</li>
        <li>Enterprise Pack: Save 35% compared to Starter</li>
      </ul>
      
      <p><strong>What happens if I don't subscribe?</strong></p>
      <p>After your trial ends, you won't be able to create new trip listings. Your existing trips will remain visible, but you'll need an active subscription to add more.</p>
      
      <p>Questions? Reply to this email or contact our support team!</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
    <div class="footer">
      <p>TrekTribe - Your Travel Adventure Platform<br>
      <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}">Visit Website</a> | 
      <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/support">Get Support</a></p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: data.organizerEmail,
        subject,
        html: htmlContent,
      });

      logger.info('Trial ending in 7 days email sent', { 
        email: data.organizerEmail,
        daysRemaining: data.daysRemaining 
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to send trial ending email', { 
        error: error.message,
        email: data.organizerEmail 
      });
      return false;
    }
  }

  /**
   * Send trial ending in 1 day urgent reminder
   */
  async sendTrialEndingIn1DayEmail(data: TrialNotificationData): Promise<boolean> {
    try {
      const subject = '🚨 URGENT: Your TrekTribe Trial Ends Tomorrow!';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #dc2626; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .urgent-box { background: #fee2e2; border: 2px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
    .cta-button { display: inline-block; background: #dc2626; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; margin: 20px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 URGENT: Trial Ending Tomorrow!</h1>
    </div>
    <div class="content">
      <p>Hi ${data.organizerName},</p>
      
      <div class="urgent-box">
        <h2 style="color: #dc2626; margin: 0 0 10px 0;">⏰ LAST DAY!</h2>
        <p style="font-size: 18px; margin: 10px 0;">Your free trial ends <strong>TOMORROW</strong> on ${data.trialEndDate.toLocaleDateString('en-IN')}</p>
      </div>
      
      <p style="font-size: 16px;"><strong>Don't lose access to your trip listings!</strong></p>
      
      <p>Subscribe now to continue:</p>
      <ul>
        <li>✓ Creating new trip listings</li>
        <li>✓ Managing bookings</li>
        <li>✓ Accessing analytics</li>
        <li>✓ Using CRM features</li>
      </ul>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/subscription/plans" class="cta-button">
          Subscribe Now - Starting at ₹1,499 →
        </a>
      </div>
      
      <p><strong>Quick Reminder:</strong> Our Growth Pack (₹2,499 for 10 trips) is our most popular choice and saves you 15%!</p>
      
      <p>Need help choosing? Reply to this email and we'll assist you!</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
    <div class="footer">
      <p>TrekTribe - Your Travel Adventure Platform</p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: data.organizerEmail,
        subject,
        html: htmlContent,
      });

      logger.info('Trial ending in 1 day email sent', { email: data.organizerEmail });
      return true;
    } catch (error: any) {
      logger.error('Failed to send urgent trial ending email', { 
        error: error.message,
        email: data.organizerEmail 
      });
      return false;
    }
  }

  /**
   * Send trial expired notification
   */
  async sendTrialExpiredEmail(data: TrialNotificationData): Promise<boolean> {
    try {
      const subject = '😔 Your TrekTribe Trial Has Ended';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #6b7280; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e0e7ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Trial Period Has Ended</h1>
    </div>
    <div class="content">
      <p>Hi ${data.organizerName},</p>
      
      <p>Your 2-month free trial with TrekTribe has ended. We hope you enjoyed exploring our platform!</p>
      
      <div class="info-box">
        <strong>📌 Your account status:</strong><br>
        • Your existing trip listings are still visible to travelers<br>
        • You cannot create new trips without an active subscription<br>
        • Upgrade anytime to regain full access
      </div>
      
      <p><strong>Ready to grow your travel business?</strong></p>
      
      <p>Choose a plan that fits your needs:</p>
      <ul>
        <li><strong>Starter Pack:</strong> ₹1,499 for 5 trips</li>
        <li><strong>Growth Pack:</strong> ₹2,499 for 10 trips (15% savings)</li>
        <li><strong>Professional Pack:</strong> ₹4,499 for 20 trips (25% savings)</li>
        <li><strong>Enterprise Pack:</strong> ₹9,999 for 50 trips (35% savings)</li>
      </ul>
      
      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://yourdomain.com'}/subscription/plans" class="cta-button">
          View Plans & Subscribe →
        </a>
      </div>
      
      <p>Have questions or need a custom plan? Our team is here to help!</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: data.organizerEmail,
        subject,
        html: htmlContent,
      });

      logger.info('Trial expired email sent', { email: data.organizerEmail });
      return true;
    } catch (error: any) {
      logger.error('Failed to send trial expired email', { 
        error: error.message,
        email: data.organizerEmail 
      });
      return false;
    }
  }

  /**
   * Check and send trial notifications
   */
  async checkAndSendTrialNotifications(): Promise<void> {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find active trials
      const activeTrials = await CRMSubscription.find({
        planType: 'trial',
        status: 'active',
        'trial.isActive': true,
      }).populate('organizerId');

      for (const subscription of activeTrials) {
        if (!subscription.trial?.endDate) continue;

        const endDate = new Date(subscription.trial.endDate);
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        const organizer = subscription.organizerId as any;
        if (!organizer || !organizer.email) continue;

        const notificationData: TrialNotificationData = {
          organizerName: organizer.name,
          organizerEmail: organizer.email,
          trialEndDate: endDate,
          daysRemaining,
          subscriptionPlans: SUBSCRIPTION_PLANS,
        };

        // 7 days before expiry
        if (daysRemaining <= 7 && daysRemaining > 1 && !subscription.notifications?.trialEndingIn7Days) {
          await this.sendTrialEndingIn7DaysEmail(notificationData);
          subscription.notifications = {
            ...subscription.notifications,
            trialEndingIn7Days: true,
            lastReminderSentAt: new Date(),
          } as any;
          await subscription.save();
        }

        // 1 day before expiry
        if (daysRemaining <= 1 && daysRemaining > 0 && !subscription.notifications?.trialEndingIn1Day) {
          await this.sendTrialEndingIn1DayEmail(notificationData);
          subscription.notifications = {
            ...subscription.notifications,
            trialEndingIn1Day: true,
            lastReminderSentAt: new Date(),
          } as any;
          await subscription.save();
        }

        // Trial expired
        if (daysRemaining <= 0 && !subscription.notifications?.trialExpired) {
          await this.sendTrialExpiredEmail(notificationData);
          subscription.status = 'expired';
          subscription.trial.isActive = false;
          subscription.notifications = {
            ...subscription.notifications,
            trialExpired: true,
            lastReminderSentAt: new Date(),
          } as any;
          await subscription.save();
        }
      }

      logger.info('Trial notifications check completed', { 
        trialsChecked: activeTrials.length 
      });
    } catch (error: any) {
      logger.error('Error checking trial notifications', { error: error.message });
    }
  }
}

export const subscriptionNotificationService = new SubscriptionNotificationService();
