import { retryQueueService } from './retryQueueService';
import { paymentsRetryAttempts, paymentsFailedTotal, paymentsSuccessTotal } from '../middleware/metrics';
import { logger } from '../utils/logger';
import Razorpay from 'razorpay';
import { razorpayService } from './razorpayService';
import { prisma } from '../lib/prisma';

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

            // Persist attempt to subscription.
            //
            // This is a retry worker, so the same charge can reach here more
            // than once - a job that succeeded but whose completion was not
            // recorded gets picked up again. transactionId is unique, so the
            // second write is refused rather than adding a second payment for
            // money that moved once. That matters more now that what an
            // organizer has paid is the sum of these rows.
            if (subscriptionId) {
              try {
                await prisma.cRMSubscriptionPayment.create({
                  data: {
                    subscriptionId,
                    razorpayOrderId: orderId,
                    razorpayPaymentId: payment.id,
                    transactionId: payment.id,
                    amount: amount / 100,
                    currency: 'INR',
                    paymentMethod: 'auto_pay',
                    status: 'completed',
                    paidAt: new Date()
                  }
                });
              } catch (err: any) {
                if (err?.code === 'P2002') {
                  logger.info('Charge already recorded for this payment id', {
                    subscriptionId, paymentId: payment.id
                  });
                } else if (err?.code === 'P2003' || err?.code === 'P2025') {
                  // The subscription is gone. Was a silent no-op before, when
                  // findById returned null and the block was skipped.
                  logger.warn('Charge succeeded but its subscription no longer exists', {
                    subscriptionId, paymentId: payment.id
                  });
                } else {
                  throw err;
                }
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
