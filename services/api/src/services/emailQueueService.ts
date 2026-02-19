import { redisService } from './redisService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';

interface EmailJob {
  id: string;
  type: string;
  to: string;
  subject: string;
  html: string;
  leadId?: string;
  tripId?: string;
  metadata?: any;
  scheduledFor: Date;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: string;
}

/**
 * Email Queue Service
 * Manages scheduled and delayed email sending using Redis
 */
class EmailQueueService {
  private readonly QUEUE_KEY = 'email:queue';
  private readonly PROCESSING_KEY = 'email:processing';
  private readonly COMPLETED_KEY = 'email:completed';
  private readonly FAILED_KEY = 'email:failed';
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Initialize the email queue service
   */
  async initialize(): Promise<void> {
    try {
      if (!redisService.isRedisConnected()) {
        logger.warn('⚠️ Email queue service disabled - Redis not connected');
        return;
      }

      logger.info('✅ Email queue service initialized');
      
      // Start processing queue
      this.startProcessing();
    } catch (error: any) {
      logger.error('Failed to initialize email queue service', { error: error.message });
      throw error;
    }
  }

  /**
   * Schedule an email to be sent after a delay
   */
  async scheduleEmail(
    emailData: {
      type: string;
      to: string;
      subject: string;
      html: string;
      leadId?: string;
      tripId?: string;
      metadata?: any;
    },
    delayMs: number
  ): Promise<string> {
    try {
      if (!redisService.isRedisConnected()) {
        logger.warn('Email queue not available - sending immediately', { to: emailData.to });
        // Fallback: send immediately
        await emailService.sendEmail({
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
        });
        return 'immediate';
      }

      const jobId = `email:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const scheduledFor = new Date(Date.now() + delayMs);

      const job: EmailJob = {
        id: jobId,
        type: emailData.type,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        leadId: emailData.leadId,
        tripId: emailData.tripId,
        metadata: emailData.metadata,
        scheduledFor,
        attempts: 0,
        maxAttempts: 3,
        status: 'pending',
        createdAt: new Date(),
      };

      // Store job in Redis with score as scheduled timestamp
      const score = scheduledFor.getTime();
      await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);
      await redisService.sAdd(`${this.QUEUE_KEY}:pending`, `${score}:${jobId}`);

      logger.info('Email scheduled', {
        jobId,
        type: emailData.type,
        to: emailData.to,
        scheduledFor: scheduledFor.toISOString(),
      });

      return jobId;
    } catch (error: any) {
      logger.error('Error scheduling email', { error: error.message });
      // Fallback: send immediately
      await emailService.sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      });
      return 'immediate-fallback';
    }
  }

  /**
   * Send an email immediately (bypass queue)
   */
  async sendImmediateEmail(emailData: {
    type: string;
    to: string;
    subject: string;
    html: string;
    leadId?: string;
    tripId?: string;
  }): Promise<boolean> {
    try {
      await emailService.sendEmail({
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      });

      logger.info('Immediate email sent', {
        type: emailData.type,
        to: emailData.to,
      });

      return true;
    } catch (error: any) {
      logger.error('Error sending immediate email', { error: error.message });
      return false;
    }
  }

  /**
   * Start processing the email queue
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    // Process queue every 30 seconds
    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 30000);

    // Process immediately on start
    this.processQueue();

    logger.info('📧 Email queue processor started');
  }

  /**
   * Stop processing the email queue
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('📧 Email queue processor stopped');
    }
  }

  /**
   * Process pending emails in the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    if (!redisService.isRedisConnected()) {
      return;
    }

    this.isProcessing = true;

    try {
      const now = Date.now();
      const pendingJobs = await redisService.sMembers(`${this.QUEUE_KEY}:pending`);

      for (const jobEntry of pendingJobs) {
        const [scoreStr, jobId] = jobEntry.split(':');
        const score = parseInt(scoreStr, 10);

        // Check if job is due
        if (score <= now) {
          await this.processJob(jobId);
          // Remove from pending set
          await redisService.sRem(`${this.QUEUE_KEY}:pending`, jobEntry);
        }
      }
    } catch (error: any) {
      logger.error('Error processing email queue', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single email job
   */
  private async processJob(jobId: string): Promise<void> {
    try {
      const job = await redisService.getJSON<EmailJob>(`${this.QUEUE_KEY}:${jobId}`);
      
      if (!job) {
        logger.warn('Job not found', { jobId });
        return;
      }

      if (job.status !== 'pending') {
        return; // Already processed
      }

      // Update status to processing
      job.status = 'processing';
      job.lastAttemptAt = new Date();
      job.attempts++;
      await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);

      // Send email
      await emailService.sendEmail({
        to: job.to,
        subject: job.subject,
        html: job.html,
      });

      // Mark as completed
      job.status = 'completed';
      await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);
      await redisService.sAdd(this.COMPLETED_KEY, jobId);

      logger.info('Email job completed', {
        jobId,
        type: job.type,
        to: job.to,
        attempts: job.attempts,
      });

      // Clean up after 24 hours
      await redisService.expire(`${this.QUEUE_KEY}:${jobId}`, 86400);
    } catch (error: any) {
      logger.error('Error processing email job', { jobId, error: error.message });
      await this.handleJobFailure(jobId, error.message);
    }
  }

  /**
   * Handle job failure and retry logic
   */
  private async handleJobFailure(jobId: string, errorMessage: string): Promise<void> {
    try {
      const job = await redisService.getJSON<EmailJob>(`${this.QUEUE_KEY}:${jobId}`);
      
      if (!job) {
        return;
      }

      job.error = errorMessage;

      if (job.attempts >= job.maxAttempts) {
        // Max attempts reached - mark as failed
        job.status = 'failed';
        await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);
        await redisService.sAdd(this.FAILED_KEY, jobId);

        logger.error('Email job failed after max attempts', {
          jobId,
          type: job.type,
          to: job.to,
          attempts: job.attempts,
          error: errorMessage,
        });
      } else {
        // Retry - reschedule for 5 minutes later
        job.status = 'pending';
        job.scheduledFor = new Date(Date.now() + 5 * 60 * 1000);
        await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);
        
        const score = job.scheduledFor.getTime();
        await redisService.sAdd(`${this.QUEUE_KEY}:pending`, `${score}:${jobId}`);

        logger.warn('Email job rescheduled for retry', {
          jobId,
          attempt: job.attempts,
          maxAttempts: job.maxAttempts,
          nextAttempt: job.scheduledFor.toISOString(),
        });
      }
    } catch (error: any) {
      logger.error('Error handling job failure', { jobId, error: error.message });
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    isConnected: boolean;
  }> {
    try {
      if (!redisService.isRedisConnected()) {
        return {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          isConnected: false,
        };
      }

      const [pending, completed, failed] = await Promise.all([
        redisService.sMembers(`${this.QUEUE_KEY}:pending`),
        redisService.sMembers(this.COMPLETED_KEY),
        redisService.sMembers(this.FAILED_KEY),
      ]);

      return {
        pending: pending.length,
        processing: 0, // We don't track this separately
        completed: completed.length,
        failed: failed.length,
        isConnected: true,
      };
    } catch (error: any) {
      logger.error('Error getting queue stats', { error: error.message });
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        isConnected: false,
      };
    }
  }

  /**
   * Get failed jobs for admin review
   */
  async getFailedJobs(limit: number = 50): Promise<EmailJob[]> {
    try {
      if (!redisService.isRedisConnected()) {
        return [];
      }

      const failedJobIds = await redisService.sMembers(this.FAILED_KEY);
      const jobs: EmailJob[] = [];

      for (const jobId of failedJobIds.slice(0, limit)) {
        const job = await redisService.getJSON<EmailJob>(`${this.QUEUE_KEY}:${jobId}`);
        if (job) {
          jobs.push(job);
        }
      }

      return jobs;
    } catch (error: any) {
      logger.error('Error getting failed jobs', { error: error.message });
      return [];
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string): Promise<boolean> {
    try {
      const job = await redisService.getJSON<EmailJob>(`${this.QUEUE_KEY}:${jobId}`);
      
      if (!job) {
        logger.warn('Job not found for retry', { jobId });
        return false;
      }

      // Reset job status
      job.status = 'pending';
      job.attempts = 0;
      job.error = undefined;
      job.scheduledFor = new Date();
      
      await redisService.setJSON(`${this.QUEUE_KEY}:${jobId}`, job);
      await redisService.sRem(this.FAILED_KEY, jobId);
      
      const score = job.scheduledFor.getTime();
      await redisService.sAdd(`${this.QUEUE_KEY}:pending`, `${score}:${jobId}`);

      logger.info('Job rescheduled for retry', { jobId });
      return true;
    } catch (error: any) {
      logger.error('Error retrying job', { jobId, error: error.message });
      return false;
    }
  }

  /**
   * Clear completed jobs older than specified days
   */
  async clearOldJobs(daysOld: number = 7): Promise<number> {
    try {
      if (!redisService.isRedisConnected()) {
        return 0;
      }

      const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      const completedJobIds = await redisService.sMembers(this.COMPLETED_KEY);
      let cleared = 0;

      for (const jobId of completedJobIds) {
        const job = await redisService.getJSON<EmailJob>(`${this.QUEUE_KEY}:${jobId}`);
        if (job && new Date(job.createdAt).getTime() < cutoffDate) {
          await redisService.del(`${this.QUEUE_KEY}:${jobId}`);
          await redisService.sRem(this.COMPLETED_KEY, jobId);
          cleared++;
        }
      }

      logger.info('Cleared old completed jobs', { cleared, daysOld });
      return cleared;
    } catch (error: any) {
      logger.error('Error clearing old jobs', { error: error.message });
      return 0;
    }
  }
}

export const emailQueue = new EmailQueueService();
export default emailQueue;
