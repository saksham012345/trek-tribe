import cron, { ScheduledTask } from 'node-cron';
import { autoPayService } from './autoPayService';
import { subscriptionNotificationService } from './subscriptionNotificationService';
import { runDailyFollowUpCheck } from './marketingAutomationService';
import { logger } from '../utils/logger';

class CronScheduler {
  private jobs: ScheduledTask[] = [];
  private tripViewCacheCleanup: NodeJS.Timeout | null = null;

  /**
   * Initialize all cron jobs
   */
  init() {
    this.scheduleAutoPayProcessing();
    this.schedulePaymentReminders();
    this.scheduleTrialNotifications();
    this.scheduleMarketingAutomation();
    this.scheduleTripViewCacheCleanup();
    
    logger.info('Cron scheduler initialized with all jobs');
  }

  /**
   * Schedule auto-pay processing - runs daily at 2 AM
   */
  private scheduleAutoPayProcessing() {
    const job = cron.schedule('0 2 * * *', async () => {
      logger.info('Running scheduled auto-pay processing');
      try {
        await autoPayService.processScheduledPayments();
        logger.info('Auto-pay processing completed successfully');
      } catch (error: any) {
        logger.error('Error in scheduled auto-pay processing', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata' // Indian timezone
    });

    this.jobs.push(job);
    logger.info('Auto-pay processing job scheduled (daily at 2 AM IST)');
  }

  /**
   * Schedule payment reminders - runs daily at 10 AM
   */
  private schedulePaymentReminders() {
    const job = cron.schedule('0 10 * * *', async () => {
      logger.info('Running scheduled payment reminders');
      try {
        await autoPayService.sendPaymentReminders();
        logger.info('Payment reminders sent successfully');
      } catch (error: any) {
        logger.error('Error sending payment reminders', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push(job);
    logger.info('Payment reminders job scheduled (daily at 10 AM IST)');
  }

  /**
   * Schedule trial notifications - runs daily at 9 AM
   */
  private scheduleTrialNotifications() {
    const job = cron.schedule('0 9 * * *', async () => {
      logger.info('Running scheduled trial notifications check');
      try {
        await subscriptionNotificationService.checkAndSendTrialNotifications();
        logger.info('Trial notifications check completed successfully');
      } catch (error: any) {
        logger.error('Error in trial notifications check', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push(job);
    logger.info('Trial notifications job scheduled (daily at 9 AM IST)');
  }

  /**
   * Schedule marketing automation - runs daily at 11 AM
   */
  private scheduleMarketingAutomation() {
    const job = cron.schedule('0 11 * * *', async () => {
      logger.info('Running scheduled marketing automation follow-ups');
      try {
        await runDailyFollowUpCheck();
        logger.info('Marketing automation follow-ups completed successfully');
      } catch (error: any) {
        logger.error('Error in marketing automation follow-ups', { error: error.message });
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    this.jobs.push(job);
    logger.info('Marketing automation job scheduled (daily at 11 AM IST)');
  }

  /**
   * Schedule trip view cache cleanup - runs every hour
   */
  private scheduleTripViewCacheCleanup() {
    // Clean up expired trip view cache entries every hour
    this.tripViewCacheCleanup = setInterval(() => {
      try {
        // Import here to avoid circular dependencies
        const { cleanupExpiredViews } = require('../middleware/tripViewTracker');
        if (cleanupExpiredViews) {
          cleanupExpiredViews();
          logger.info('Trip view cache cleanup completed');
        }
      } catch (error: any) {
        logger.error('Error in trip view cache cleanup', { error: error.message });
      }
    }, 60 * 60 * 1000); // Every hour

    logger.info('Trip view cache cleanup scheduled (every hour)');
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    this.jobs.forEach(job => job.stop());
    if (this.tripViewCacheCleanup) {
      clearInterval(this.tripViewCacheCleanup);
      this.tripViewCacheCleanup = null;
    }
    logger.info('All cron jobs stopped');
  }

  /**
   * Get status of all cron jobs
   */
  getStatus() {
    return {
      totalJobs: this.jobs.length + (this.tripViewCacheCleanup ? 1 : 0),
      jobs: [
        { name: 'Auto-pay processing', schedule: 'Daily at 2 AM IST' },
        { name: 'Payment reminders', schedule: 'Daily at 10 AM IST' },
        { name: 'Trial notifications', schedule: 'Daily at 9 AM IST' },
        { name: 'Marketing automation', schedule: 'Daily at 11 AM IST' },
        { name: 'Trip view cache cleanup', schedule: 'Every hour' }
      ]
    };
  }
}

export const cronScheduler = new CronScheduler();
