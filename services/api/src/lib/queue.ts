import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | undefined;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null
    });
  }
  return connection;
}

export const VENDOR_NOTIFICATION_QUEUE = 'vendor-notifications';
export const VENDOR_RELAY_QUEUE = 'vendor-relay';

export const vendorNotificationQueue = new Queue(VENDOR_NOTIFICATION_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 }
  }
});

export const vendorRelayQueue = new Queue(VENDOR_RELAY_QUEUE, {
  connection: getRedisConnection()
});
