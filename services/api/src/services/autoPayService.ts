import { User } from '../models/User';
import CRMSubscription from '../models/CRMSubscription';
import { razorpayService } from './razorpayService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';
import { retryQueueService } from './retryQueueService';
import { paymentsSuccessTotal, paymentsFailedTotal, paymentsRetriesTotal } from '../middleware/metrics';

interface AutoPaySetupParams {
  userId: string;
  razorpayCustomerId: string;
  paymentMethodId: string;
  paymentAmount: number;
}

interface ProcessScheduledPaymentResult {
  success: boolean;
  paymentId?: string;
  error?: string;
}

class AutoPayService {
  /**
   * Setup auto-pay for an organizer
   */
  async setupAutoPay(params: AutoPaySetupParams): Promise<boolean> {
    try {
      const { userId, razorpayCustomerId, paymentMethodId, paymentAmount } = params;

      const user = await User.findById(userId);
      if (!user || user.role !== 'organizer') {
        throw new Error('User not found or not an organizer');
      }

      if (!user.organizerProfile) {
        user.organizerProfile = {};
      }

      if (!user.organizerProfile.autoPay) {
        // If auto-pay not initialized, create it
        const scheduledPaymentDate = new Date();
        scheduledPaymentDate.setDate(scheduledPaymentDate.getDate() + 60);

        user.organizerProfile.autoPay = {
          isSetupRequired: true,
          isSetupCompleted: false,
          firstLoginDate: user.firstOrganizerLogin || new Date(),
          scheduledPaymentDate: scheduledPaymentDate,
          paymentAmount: paymentAmount,
          autoPayEnabled: false
        };
      }

      // Update auto-pay information
      user.organizerProfile.autoPay.isSetupCompleted = true;
      user.organizerProfile.autoPay.setupCompletedDate = new Date();
      user.organizerProfile.autoPay.razorpayCustomerId = razorpayCustomerId;
      user.organizerProfile.autoPay.paymentMethodId = paymentMethodId;
      user.organizerProfile.autoPay.paymentAmount = paymentAmount;
      user.organizerProfile.autoPay.autoPayEnabled = true;

      await user.save();

      logger.info('Auto-pay setup completed', {
        userId,
        scheduledPaymentDate: user.organizerProfile.autoPay.scheduledPaymentDate,
        paymentAmount
      });

      // Send confirmation email
      await this.sendAutoPaySetupConfirmation(user);

      return true;
    } catch (error: any) {
      logger.error('Failed to setup auto-pay', { error: error.message, userId: params.userId });
      throw error;
    }
  }

  /**
   * Process scheduled payments for organizers whose 60-day period has elapsed
   */
  async processScheduledPayments(): Promise<void> {
    try {
      const now = new Date();

      // Find organizers with auto-pay enabled and scheduled payment date <= now
      const users = await User.find({
        role: 'organizer',
        'organizerProfile.autoPay.autoPayEnabled': true,
        'organizerProfile.autoPay.isSetupCompleted': true,
        'organizerProfile.autoPay.scheduledPaymentDate': { $lte: now }
      });

      logger.info(`Found ${users.length} organizers with payments due`);

      for (const user of users) {
        try {
          await this.processPaymentForOrganizer(user);
        } catch (error: any) {
          logger.error('Failed to process payment for organizer', {
            userId: user._id,
            error: error.message
          });
          // Continue processing other organizers
        }
      }
    } catch (error: any) {
      logger.error('Error processing scheduled payments', { error: error.message });
    }
  }

  /**
   * Process payment for a specific organizer
   */
  private async processPaymentForOrganizer(user: any): Promise<ProcessScheduledPaymentResult> {
    try {
      const autoPay = user.organizerProfile?.autoPay;
      if (!autoPay || !autoPay.razorpayCustomerId || !autoPay.paymentAmount) {
        return { success: false, error: 'Auto-pay not properly configured' };
      }

      const receiptId = razorpayService.generateReceiptId(String(user._id), 'autopay_5trips');
      const order = await razorpayService.createOrder({
        amount: autoPay.paymentAmount,
        currency: 'INR',
        receipt: receiptId,
        notes: { userId: String(user._id), type: 'auto_pay', packageType: '5_trips' }
      });

      // Try to charge immediately
      try {
        const payment = await razorpayService.chargeCustomer({
          customerId: autoPay.razorpayCustomerId,
          paymentMethodId: autoPay.paymentMethodId,
          amount: autoPay.paymentAmount,
          orderId: order.id,
          capture: true
        });

        // Success metrics
        paymentsSuccessTotal.inc();

        const amountPaid = (payment?.amount || autoPay.paymentAmount) / 100;

        // Update or create subscription
        let subscription = await CRMSubscription.findOne({ organizerId: user._id });
        if (!subscription) {
          subscription = new CRMSubscription({
            organizerId: user._id,
            planType: 'trip_package_5',
            status: 'active',
            tripPackage: { packageType: '5_trips', totalTrips: 5, usedTrips: 0, remainingTrips: 5, pricePerPackage: autoPay.paymentAmount / 100 },
            notifications: { trialEndingIn7Days: false, trialEndingIn1Day: false, trialExpired: false, paymentReminder: false }
          });
        } else {
          if (!subscription.tripPackage) {
            subscription.tripPackage = { packageType: '5_trips', totalTrips: 5, usedTrips: 0, remainingTrips: 5, pricePerPackage: autoPay.paymentAmount / 100 };
          } else {
            subscription.tripPackage.totalTrips += 5;
            subscription.tripPackage.remainingTrips += 5;
          }
        }

        // Persist payment attempt and success
        subscription.paymentAttempts = subscription.paymentAttempts || [];
        subscription.paymentAttempts.push({
          attemptId: payment?.id || `rcpt_${Date.now()}`,
          razorpayOrderId: order.id,
          razorpayPaymentId: payment?.id,
          amount: amountPaid,
          status: 'success',
          createdAt: new Date()
        } as any);

        subscription.payments.push({
          razorpayOrderId: order.id,
          razorpayPaymentId: payment?.id,
          transactionId: payment?.id || receiptId,
          amount: amountPaid,
          currency: 'INR',
          paymentMethod: 'auto_pay',
          status: 'completed',
          paidAt: new Date(),
          metadata: { raw: payment }
        } as any);

        subscription.billingHistory.push({ date: new Date(), amount: amountPaid, description: 'Auto-Pay: Trip Package - 5 Trips' } as any);
        await subscription.save();

        // Update autoPay schedule
        autoPay.lastPaymentDate = new Date();
        const nextPaymentDate = new Date(); nextPaymentDate.setDate(nextPaymentDate.getDate() + 60);
        autoPay.nextPaymentDate = nextPaymentDate; autoPay.scheduledPaymentDate = nextPaymentDate;
        await user.save();

        // Send confirmation
        await this.sendPaymentConfirmation(user, amountPaid, order.id);

        return { success: true, paymentId: payment?.id || order.id };
      } catch (chargeErr: any) {
        // Charge failed: record attempt, enqueue retry
        paymentsFailedTotal.inc();

        // Persist a failed attempt on subscription for audit
        let subscription = await CRMSubscription.findOne({ organizerId: user._id });
        if (!subscription) {
          subscription = new CRMSubscription({ organizerId: user._id, planType: 'trip_package_5', status: 'pending' });
        }
        subscription.paymentAttempts = subscription.paymentAttempts || [];
        subscription.paymentAttempts.push({
          attemptId: `failed_${Date.now()}`,
          razorpayOrderId: order.id,
          razorpayPaymentId: undefined,
          amount: autoPay.paymentAmount / 100,
          status: 'failed',
          errorMessage: chargeErr.message || String(chargeErr),
          createdAt: new Date()
        } as any);
        await subscription.save();

        // Enqueue retry job
        const delayMs = retryQueueService.calculateBackoffMs(subscription.paymentAttempts.length || 1);
        await retryQueueService.enqueue('charge', String(subscription._id || user._id), {
          organizerId: String(user._id),
          subscriptionId: String(subscription._id),
          razorpayCustomerId: autoPay.razorpayCustomerId,
          paymentMethodId: autoPay.paymentMethodId,
          amount: autoPay.paymentAmount,
          orderId: order.id
        }, delayMs);
        paymentsRetriesTotal.inc();

        // Notify user
        await this.sendPaymentFailureNotification(user, chargeErr.message || 'Auto-pay charge failed');

        logger.warn('Auto-pay charge failed and enqueued for retry', { userId: user._id, orderId: order.id, error: chargeErr.message });
        return { success: false, error: chargeErr.message };
      }
    } catch (error: any) {
      logger.error('Failed to process payment', { userId: user._id, error: error.message });
      await this.sendPaymentFailureNotification(user, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check upcoming payments and send reminders
   */
  async sendPaymentReminders(): Promise<void> {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Find organizers with payments due in 3 days
      const users = await User.find({
        role: 'organizer',
        'organizerProfile.autoPay.autoPayEnabled': true,
        'organizerProfile.autoPay.scheduledPaymentDate': {
          $gte: now,
          $lte: threeDaysFromNow
        }
      });

      logger.info(`Sending payment reminders to ${users.length} organizers`);

      for (const user of users) {
        try {
          await this.sendUpcomingPaymentReminder(user);
        } catch (error: any) {
          logger.error('Failed to send payment reminder', {
            userId: user._id,
            error: error.message
          });
        }
      }
    } catch (error: any) {
      logger.error('Error sending payment reminders', { error: error.message });
    }
  }

  /**
   * Send auto-pay setup confirmation email
   */
  private async sendAutoPaySetupConfirmation(user: any): Promise<void> {
    try {
      const autoPay = user.organizerProfile?.autoPay;
      if (!autoPay) return;

      const subject = '✅ Auto-Pay Setup Confirmed - TrekTribe';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Auto-Pay Activated!</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      
      <p>Your auto-pay has been successfully set up for TrekTribe!</p>
      
      <div class="info-box">
        <strong>📅 Payment Schedule:</strong><br>
        • First Payment Date: ${autoPay.scheduledPaymentDate?.toLocaleDateString('en-IN')}<br>
        • Payment Amount: ₹${(autoPay.paymentAmount / 100).toFixed(2)}<br>
        • Frequency: Every 60 days<br>
        • Package: 5 Trip Listings
      </div>
      
      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Your first auto-payment will be processed on ${autoPay.scheduledPaymentDate?.toLocaleDateString('en-IN')} (exactly 60 days from your first login)</li>
        <li>You'll receive 5 trip listing credits with each payment</li>
        <li>Payments will automatically repeat every 60 days</li>
        <li>You can manage or cancel auto-pay anytime from your dashboard</li>
      </ul>
      
      <p><strong>Benefits of Auto-Pay:</strong></p>
      <ul>
        <li>✓ Never run out of trip listing credits</li>
        <li>✓ Seamless, hassle-free payments</li>
        <li>✓ Focus on growing your business, not managing subscriptions</li>
      </ul>
      
      <p>If you have any questions or need to modify your auto-pay settings, please contact our support team.</p>
      
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
        to: user.email,
        subject,
        html: htmlContent
      });

      logger.info('Auto-pay setup confirmation sent', { email: user.email });
    } catch (error: any) {
      logger.error('Failed to send auto-pay setup confirmation', { error: error.message });
    }
  }

  /**
   * Send payment confirmation email
   */
  private async sendPaymentConfirmation(user: any, amount: number, orderId: string): Promise<void> {
    try {
      const subject = '💳 Payment Successful - TrekTribe Auto-Pay';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10b981; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-box { background: #d1fae5; border: 2px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 8px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Payment Successful!</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      
      <div class="success-box">
        <h2 style="color: #10b981; margin: 0 0 10px 0;">₹${amount.toFixed(2)} Paid</h2>
        <p style="margin: 5px 0;">Order ID: ${orderId}</p>
        <p style="margin: 5px 0;">Date: ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
      
      <p><strong>Your auto-payment has been processed successfully!</strong></p>
      
      <p><strong>What you received:</strong></p>
      <ul>
        <li>✓ 5 Trip Listing Credits added to your account</li>
        <li>✓ Valid for posting new trip listings</li>
        <li>✓ Next payment scheduled in 60 days</li>
      </ul>
      
      <p>You can start creating new trip listings right away from your dashboard.</p>
      
      <p>Thank you for being a valued TrekTribe organizer!</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject,
        html: htmlContent
      });

      logger.info('Payment confirmation sent', { email: user.email, orderId });
    } catch (error: any) {
      logger.error('Failed to send payment confirmation', { error: error.message });
    }
  }

  /**
   * Send payment failure notification
   */
  private async sendPaymentFailureNotification(user: any, errorMessage: string): Promise<void> {
    try {
      const subject = '⚠️ Auto-Payment Failed - Action Required';
      
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
    .warning-box { background: #fee2e2; border: 2px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Payment Failed</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      
      <div class="warning-box">
        <strong>We couldn't process your auto-payment.</strong><br>
        Your scheduled payment failed and requires your attention.
      </div>
      
      <p><strong>What to do next:</strong></p>
      <ol>
        <li>Log in to your TrekTribe dashboard</li>
        <li>Update your payment method or retry the payment</li>
        <li>Contact support if you need assistance</li>
      </ol>
      
      <p><strong>Important:</strong> Until payment is successful, you may not be able to create new trip listings.</p>
      
      <p>If you have any questions, please reply to this email or contact our support team.</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject,
        html: htmlContent
      });

      logger.info('Payment failure notification sent', { email: user.email });
    } catch (error: any) {
      logger.error('Failed to send payment failure notification', { error: error.message });
    }
  }

  /**
   * Send upcoming payment reminder
   */
  private async sendUpcomingPaymentReminder(user: any): Promise<void> {
    try {
      const autoPay = user.organizerProfile?.autoPay;
      if (!autoPay) return;

      const subject = '🔔 Upcoming Auto-Payment Reminder - TrekTribe';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-box { background: #e0e7ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Payment Reminder</h1>
    </div>
    <div class="content">
      <p>Hi ${user.name},</p>
      
      <p>This is a friendly reminder that your auto-payment is scheduled soon.</p>
      
      <div class="info-box">
        <strong>📅 Scheduled Payment:</strong><br>
        • Date: ${autoPay.scheduledPaymentDate?.toLocaleDateString('en-IN')}<br>
        • Amount: ₹${(autoPay.paymentAmount / 100).toFixed(2)}<br>
        • Package: 5 Trip Listings
      </div>
      
      <p>Your payment method on file will be automatically charged on the scheduled date.</p>
      
      <p><strong>Need to make changes?</strong></p>
      <p>You can update your payment method or cancel auto-pay anytime from your dashboard settings.</p>
      
      <p>Best regards,<br><strong>The TrekTribe Team</strong></p>
    </div>
  </div>
</body>
</html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject,
        html: htmlContent
      });

      logger.info('Payment reminder sent', { email: user.email });
    } catch (error: any) {
      logger.error('Failed to send payment reminder', { error: error.message });
    }
  }

  /**
   * Cancel auto-pay for an organizer
   */
  async cancelAutoPay(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user || user.role !== 'organizer') {
        throw new Error('User not found or not an organizer');
      }

      if (!user.organizerProfile?.autoPay) {
        throw new Error('Auto-pay not configured');
      }

      user.organizerProfile.autoPay.autoPayEnabled = false;
      await user.save();

      logger.info('Auto-pay cancelled', { userId });

      // Send cancellation confirmation email
      await emailService.sendEmail({
        to: user.email,
        subject: 'Auto-Pay Cancelled - TrekTribe',
        html: `
          <p>Hi ${user.name},</p>
          <p>Your auto-pay has been successfully cancelled.</p>
          <p>You can re-enable it anytime from your dashboard.</p>
          <p>Best regards,<br>The TrekTribe Team</p>
        `
      });

      return true;
    } catch (error: any) {
      logger.error('Failed to cancel auto-pay', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get auto-pay status for an organizer
   */
  async getAutoPayStatus(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId).select('organizerProfile.autoPay firstOrganizerLogin');
      if (!user || !user.organizerProfile?.autoPay) {
        return null;
      }

      return {
        isSetupRequired: user.organizerProfile.autoPay.isSetupRequired,
        isSetupCompleted: user.organizerProfile.autoPay.isSetupCompleted,
        autoPayEnabled: user.organizerProfile.autoPay.autoPayEnabled,
        firstLoginDate: user.organizerProfile.autoPay.firstLoginDate,
        scheduledPaymentDate: user.organizerProfile.autoPay.scheduledPaymentDate,
        lastPaymentDate: user.organizerProfile.autoPay.lastPaymentDate,
        nextPaymentDate: user.organizerProfile.autoPay.nextPaymentDate,
        paymentAmount: user.organizerProfile.autoPay.paymentAmount
      };
    } catch (error: any) {
      logger.error('Failed to get auto-pay status', { error: error.message, userId });
      throw error;
    }
  }
}

export const autoPayService = new AutoPayService();
