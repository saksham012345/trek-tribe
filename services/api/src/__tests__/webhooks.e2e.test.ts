import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import app from '../serverless';
import WebhookEvent from '../models/WebhookEvent';

beforeEach(async () => {
  // Clear webhook events before each test to ensure idempotency works
  await WebhookEvent.deleteMany({});
});

describe('Razorpay Webhooks E2E', () => {
  const webhookPath = '/api/webhooks/razorpay';

  const payload = {
    id: 'evt_test_123',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test_123',
          order_id: 'order_test_123',
          amount: 50000,
          status: 'captured',
          method: 'card',
          notes: { type: 'booking' }
        }
      }
    }
  };

  function signatureFor(obj: any, secret: string) {
    const raw = JSON.stringify(obj);
    return crypto.createHmac('sha256', secret).update(raw).digest('hex');
  }

  it('accepts a valid signed webhook and processes it', async () => {
    const sig = signatureFor(payload, process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret');

    const res = await request(app)
      .post(webhookPath)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(payload)
      .expect(200);

    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('rejects invalid signature', async () => {
    const badSig = 'bad_signature';

    const res = await request(app)
      .post(webhookPath)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', badSig)
      .send(payload)
      .expect(400);

    expect(res.body).toHaveProperty('error', 'Invalid signature');
  });

  it('ignores duplicate delivery (idempotency)', async () => {
    const sig = signatureFor(payload, process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret');

    // First delivery
    const first = await request(app)
      .post(webhookPath)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(payload)
      .expect(200);

    expect(first.body).toHaveProperty('status', 'ok');

    // Second delivery (duplicate)
    const second = await request(app)
      .post(webhookPath)
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', sig)
      .send(payload)
      .expect(200);

    // Duplicate handler responds with already_processed
    expect(second.body).toHaveProperty('status', 'already_processed');
  });
});
