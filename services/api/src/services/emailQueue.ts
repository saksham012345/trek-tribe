import Bull, { Queue, Job } from 'bull';
import { logger } from '../utils/logger';
import { emailService } from './emailService';

interface EmailJob {
  type: 'booking_abandonment' | 'chat_followup' | 'marketing_drip' | 'generic';
  to: string;
  subject: string;
  html: string;
  metadata?: any;
  leadId?: string;
  tripId?: string;
}

class EmailQueueService {
  private emailQueue: Queue<EmailJob>;
  private isInitialized = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    this.emailQueue = new Bull<EmailJob>('email-queue', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.setupProcessors();
    this.setupEventHandlers();
  }

  async initialize(): Promise<void> {
    try {
      await this.emailQueue.isReady();
      this.isInitialized = true;
      logger.info('Email queue initialized');
    } catch (error: any) {
      logger.error('Email queue init failed', { error: error.message });
    }
  }

  private setupProcessors(): void {
    this.emailQueue.process(async (job: Job<EmailJob>) => {
      const { type, to, subject, html } = job.data;
      logger.info('Processing email', { jobId: job.id, type, to });

      if (!emailService.isServiceReady()) {
        throw new Error('Email service not ready');
      }

      await emailService.sendEmail({ to, subject, html });
      return { success: true, sentAt: new Date() };
    });
  }

  private setupEventHandlers(): void {
    this.emailQueue.on('completed', (job: Job) => {
      logger.info('Email sent', { jobId: job.id, to: job.data.to });
    });

    this.emailQueue.on('failed', (job: Job, error: Error) => {
      logger.error('Email failed', {
        jobId: job.id,
        to: job.data.to,
        error: error.message,
      });
    });
  }

  async scheduleEmail(emailData: EmailJob, delayMs: number): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Queue not initialized, skipping email');
      return;
    }

    await this.emailQueue.add(emailData, { delay: delayMs });
    logger.info('Email scheduled', {
      type: emailData.type,
      to: emailData.to,
      delayHours: delayMs / (1000 * 60 * 60),
    });
  }

  async sendImmediateEmail(emailData: EmailJob): Promise<void> {
    await this.scheduleEmail(emailData, 0);
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
      this.emailQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async close(): Promise<void> {
    await this.emailQueue.close();
    this.isInitialized = false;
  }
}

export const emailQueue = new EmailQueueService();
export default emailQueue;
