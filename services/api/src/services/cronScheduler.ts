import cron, { ScheduledTask } from 'node-cron';
import { autoPayService } from './autoPayService';
import { subscriptionNotificationService } from './subscriptionNotificationService';
import { logger } from '../utils/logger';

class CronScheduler {
  private jobs: ScheduledTask[] = [];

  /**
   * Initialize all cron jobs
   */
  init() {
    this.scheduleAutoPayProcessing();
    this.schedulePaymentReminders();
    this.scheduleTrialNotifications();
    
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
   * Stop all cron jobs
   */
  stopAll() {
    this.jobs.forEach(job => job.stop());
    logger.info('All cron jobs stopped');
  }

  /**
   * Get status of all cron jobs
   */
  getStatus() {
    return {
      totalJobs: this.jobs.length,
      jobs: [
        { name: 'Auto-pay processing', schedule: 'Daily at 2 AM IST' },
        { name: 'Payment reminders', schedule: 'Daily at 10 AM IST' },
        { name: 'Trial notifications', schedule: 'Daily at 9 AM IST' }
      ]
    };
  }
}

export const cronScheduler = new CronScheduler();
