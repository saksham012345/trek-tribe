import RetryJob, { IRetryJob } from '../models/RetryJob';
import { logger } from '../utils/logger';
import { paymentsRetriesTotal } from '../middleware/metrics';

/**
 * RetryQueueService
 * - Enqueue retry jobs
 * - Fetch due jobs
 * - Update job state
 */
class RetryQueueService {
  // Add a new job
  async enqueue(jobType: string, referenceId: string, payload: any, delayMs = 0, maxRetries = 5): Promise<IRetryJob> {
    try {
      const nextRetryAt = delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();
      const job = await RetryJob.create({ jobType, referenceId, payload, nextRetryAt, status: 'pending', maxRetries });
      paymentsRetriesTotal.inc();
      logger.info('Enqueued retry job', { jobId: job._id, jobType, referenceId });
      return job;
    } catch (err: any) {
      logger.error('Failed to enqueue retry job', { error: err.message });
      throw err;
    }
  }

  // Get due jobs up to limit
  async getDueJobs(limit = 10): Promise<IRetryJob[]> {
    const now = new Date();
    return RetryJob.find({ status: 'pending', nextRetryAt: { $lte: now } })
      .sort({ nextRetryAt: 1 })
      .limit(limit)
      .lean();
  }

  async markInProgress(jobId: string): Promise<void> {
    await RetryJob.findByIdAndUpdate(jobId, { status: 'in_progress', lastAttempt: new Date() });
  }

  async complete(jobId: string): Promise<void> {
    await RetryJob.findByIdAndUpdate(jobId, { status: 'completed' });
  }

  // (Original fail implementation removed — unified fail handled below to provide
  // backward-compatible signatures used by worker code.)

  async cancelJob(jobId: string): Promise<void> {
    await RetryJob.findByIdAndUpdate(jobId, { status: 'cancelled' });
  }

  async list(filter: any = {}, limit = 50, skip = 0) {
    const query = RetryJob.find(filter).sort({ createdAt: -1 }).limit(limit).skip(skip);
    return query;
  }

  calculateBackoffMs(retryCount: number) {
    const base = 60 * 1000; // 1 minute
    const backoff = Math.pow(2, retryCount) * base;
    const jitter = Math.floor(Math.random() * base);
    return backoff + jitter;
  }

  // Compatibility aliases used by workers
  async dequeueDue(limit = 10): Promise<IRetryJob[]> {
    return this.getDueJobs(limit);
  }

  // Fail with older signature (jobId, errMsg, retryCount?, maxRetries?)
  async fail(jobId: string, errMsg: string, retryCountOrDelay?: number, maxRetries?: number): Promise<{ nextRetryAt?: Date } | void> {
    // If caller passed a retryCount (number > 0 and likely small), compute delay
    let delayMs: number | undefined = undefined;
    if (typeof retryCountOrDelay === 'number') {
      // Heuristic: if the value looks like a retryCount (<= 1000), compute backoff
      if (retryCountOrDelay > 0 && retryCountOrDelay < 100000) {
        delayMs = this.calculateBackoffMs(retryCountOrDelay);
      } else {
        // otherwise treat as explicit delay
        delayMs = retryCountOrDelay;
      }
    }
    await this._failInternal(jobId, errMsg, delayMs);
    if (typeof delayMs === 'number') return { nextRetryAt: new Date(Date.now() + delayMs) };
    return;
  }

  // Internal helper to keep original fail behavior
  private async _failInternal(jobId: string, errMsg: string, retryDelayMs?: number) {
    // reuse existing fail implementation signature
    const existing = (this as any).fail;
    if (existing && existing !== this.fail) {
      // call original implementation
      return existing.call(this, jobId, errMsg, retryDelayMs);
    }
    // fallback: update job directly
    const job = await RetryJob.findById(jobId);
    if (!job) return;
    job.retryCount = (job.retryCount || 0) + 1;
    job.lastError = errMsg;
    job.lastAttempt = new Date();
    if (typeof retryDelayMs === 'number' && retryDelayMs > 0 && job.retryCount < (job.maxRetries || 5)) {
      job.nextRetryAt = new Date(Date.now() + retryDelayMs);
      job.status = 'pending';
    } else if (job.retryCount >= (job.maxRetries || 5)) {
      job.status = 'failed';
    } else {
      job.status = 'failed';
    }
    await job.save();
  }

  async cancel(jobId: string): Promise<void> {
    return this.cancelJob(jobId);
  }

  async markSucceeded(jobId: string, note?: string): Promise<void> {
    return this.complete(jobId);
  }

  async markFailed(jobId: string, reason?: string, delayMs?: number): Promise<void> {
    await this.fail(jobId, reason || 'failed', delayMs as any);
    return;
  }
}

export const retryQueueService = new RetryQueueService();
