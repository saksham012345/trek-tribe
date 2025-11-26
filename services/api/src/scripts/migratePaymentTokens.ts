#!/usr/bin/env node
import 'dotenv/config';
import mongoose from 'mongoose';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { validatePaymentMethodId } from '../services/paymentTokenService';
import { logger } from '../utils/logger';

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI is required to run migration');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB for payment token migration');

  const cursor = OrganizerSubscription.find({}).cursor();
  let processed = 0;
  for await (const sub of cursor) {
    processed++;
    const token = (sub as any).paymentMethodId as string | undefined;
    const result = await validatePaymentMethodId(token);

    // Update subscription with validation result
    try {
      sub.set('paymentMethodValid', result.valid);
      // If invalid, disable autoRenew so we don't attempt charges
      if (!result.valid) {
        sub.autoRenew = false;
        // add notification to prompt re-collection (non-blocking)
        sub.notificationsSent.push({
          type: 'payment_failed',
          sentAt: new Date(),
          message: `Stored payment method is invalid or unverified (${result.reason || 'unknown'}). Please update payment method.`
        } as any);
      }

      await sub.save();
      console.log(`Processed subscription ${sub._id}: valid=${result.valid} reason=${result.reason || 'ok'}`);
    } catch (err: any) {
      logger.error('Failed to update subscription during migration', { error: err.message, subscriptionId: sub._id });
    }
  }

  console.log(`Migration complete. Processed ${processed} subscriptions`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed', err);
  process.exit(1);
});
