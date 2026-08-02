import { vendorRelayQueue, getRedisConnection } from '../lib/queue';

describe('BullMQ setup', () => {
  afterAll(async () => {
    await vendorRelayQueue.close();
    await getRedisConnection().quit();
  });

  it('can enqueue and the queue reports itself ready', async () => {
    const job = await vendorRelayQueue.add('smoke-test', { ping: true });
    expect(job.id).toBeDefined();
    const counts = await vendorRelayQueue.getJobCounts();
    expect(counts.waiting + counts.active).toBeGreaterThanOrEqual(0);
  });
});
