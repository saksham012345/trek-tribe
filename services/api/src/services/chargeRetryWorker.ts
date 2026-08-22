import { retryQueueService } from './retryQueueService';
import { paymentsRetryAttempts, paymentsFailedTotal, paymentsSuccessTotal } from '../middleware/metrics';
import { logger } from '../utils/logger';
import Razorpay from 'razorpay';
import { razorpayService } from './razorpayService';
import CRMSubscription from '../models/CRMSubscription';

class ChargeRetryWorker {
  private intervalMs: number = 30 * 1000; // poll every 30s
  private timer: NodeJS.Timeout | null = null;

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(err => logger.error('RetryWorker tick error', { error: err.message })), this.intervalMs);
    logger.info('ChargeRetryWorker started');
  }

  stop() {
    if (this.timer) clearInterval(this.timer as NodeJS.Timeout);
    this.timer = null;
    logger.info('ChargeRetryWorker stopped');
  }

  async tick() {
    const jobs = await retryQueueService.dequeueDue(10);
    if (!jobs || jobs.length === 0) return;

    for (const job of jobs) {
      try {
        await retryQueueService.markInProgress(job.id);
        paymentsRetryAttempts.inc();

        if (job.jobType === 'charge') {
          // payload is a JSON column, so its shape is asserted here rather
          // than being implied by a Mixed field.
          const payload = (job.payload || {}) as Record<string, any>;
          // Payload expected: { organizerId, subscriptionId, razorpayCustomerId, paymentMethodId, amount, orderId }
          const { organizerId, subscriptionId, razorpayCustomerId, paymentMethodId, amount, orderId } = payload;

          try {
            const payment = await razorpayService.chargeCustomer({
              customerId: razorpayCustomerId,
              paymentMethodId,
              amount: amount,
              orderId
            });

            // Update subscription and mark job complete
            paymentsSuccessTotal.inc();
            await retryQueueService.complete(job.id);

            // Persist attempt to subscription
            if (subscriptionId) {
              const sub = await CRMSubscription.findById(subscriptionId);
              if (sub) {
                sub.payments.push({
                  razorpayOrderId: orderId,
                  razorpayPaymentId: payment.id,
                  transactionId: payment.id,
                  amount: amount / 100,
                  currency: 'INR',
                  paymentMethod: 'auto_pay',
                  status: 'completed',
                  paidAt: new Date()
                } as any);
                sub.markModified('payments');
                await sub.save();
              }
            }

          } catch (err: any) {
            paymentsFailedTotal.inc();
            const nextRetry = await retryQueueService.fail(job.id, err.message || String(err), job.retryCount + 1, job.maxRetries);
            const nextRetryAt = (nextRetry as any)?.nextRetryAt;
            logger.warn('ChargeRetryWorker: charge failed, scheduled retry', { jobId: job.id, nextRetryAt });
          }
        } else {
          // Unknown job type - cancel
          await retryQueueService.cancel(job.id);
          logger.warn('ChargeRetryWorker: unknown job type, cancelled', { jobType: job.jobType, jobId: job.id });
        }
      } catch (error: any) {
        logger.error('ChargeRetryWorker error processing job', { error: error.message, jobId: job.id });
      }
    }
  }
}

export const chargeRetryWorker = new ChargeRetryWorker();
// Consolidated implementation: class-based worker exported as `chargeRetryWorker` above.
// The procedural functions below were duplicate implementations and have been removed.
// If other parts of the codebase need start/stop functions, they should import and use
// `chargeRetryWorker.start()` / `.stop()` instead.
