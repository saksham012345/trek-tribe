import { RetryJob as RetryJobRow } from '@prisma/client';
import { prisma } from '../lib/prisma';
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
  async enqueue(jobType: string, referenceId: string, payload: any, delayMs = 0, maxRetries = 5): Promise<RetryJobRow> {
    try {
      const nextRetryAt = delayMs > 0 ? new Date(Date.now() + delayMs) : new Date();
      const job = await prisma.retryJob.create({
        data: { jobType, referenceId, payload, nextRetryAt, status: 'pending', maxRetries }
      });
      paymentsRetriesTotal.inc();
      logger.info('Enqueued retry job', { jobId: job.id, jobType, referenceId });
      return job;
    } catch (err: any) {
      logger.error('Failed to enqueue retry job', { error: err.message });
      throw err;
    }
  }

  // Get due jobs up to limit
  async getDueJobs(limit = 10): Promise<RetryJobRow[]> {
    const now = new Date();
    return await prisma.retryJob.findMany({
      where: { status: 'pending', nextRetryAt: { lte: now } },
      orderBy: { nextRetryAt: 'asc' },
      take: limit
    });
  }

  async markInProgress(jobId: string): Promise<void> {
    await prisma.retryJob.update({ where: { id: jobId }, data: { status: 'in_progress', lastAttempt: new Date() } });
  }

  async complete(jobId: string): Promise<void> {
    await prisma.retryJob.update({ where: { id: jobId }, data: { status: 'completed' } });
  }

  // (Original fail implementation removed — unified fail handled below to provide
  // backward-compatible signatures used by worker code.)

  async cancelJob(jobId: string): Promise<void> {
    await prisma.retryJob.update({ where: { id: jobId }, data: { status: 'cancelled' } });
  }

  async list(filter: any = {}, limit = 50, skip = 0) {
    return await prisma.retryJob.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip
    });
  }

  calculateBackoffMs(retryCount: number) {
    const base = 60 * 1000; // 1 minute
    const backoff = Math.pow(2, retryCount) * base;
    const jitter = Math.floor(Math.random() * base);
    return backoff + jitter;
  }

  // Compatibility aliases used by workers
  async dequeueDue(limit = 10): Promise<RetryJobRow[]> {
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
    const job = await prisma.retryJob.findUnique({ where: { id: jobId } });
    if (!job) return;
    const retryCount = (job.retryCount || 0) + 1;
    const maxRetries = job.maxRetries || 5;
    const willRetry =
      typeof retryDelayMs === 'number' && retryDelayMs > 0 && retryCount < maxRetries;

    await prisma.retryJob.update({
      where: { id: jobId },
      data: {
        retryCount,
        lastError: errMsg,
        lastAttempt: new Date(),
        status: willRetry ? 'pending' : 'failed',
        ...(willRetry ? { nextRetryAt: new Date(Date.now() + retryDelayMs) } : {})
      }
    });
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
