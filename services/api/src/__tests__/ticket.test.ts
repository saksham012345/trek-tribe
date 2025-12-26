import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { User } from '../models/User';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-1234567890';
  // Only connect if not already connected (setup.ts may have connected us)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Support tickets API', () => {
  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/support/tickets').send({ subject: 'Hi', description: 'Hello' });
    expect(res.status).toBe(401);
  });

  it('creates ticket when authenticated and valid payload', async () => {
    // create user
    const user = await User.create({ email: 'test@example.com', passwordHash: 'hash', name: 'Test User' });
    const token = jwt.sign({ userId: user._id.toString(), id: user._id.toString(), role: 'traveler' }, process.env.JWT_SECRET as string);

    const res = await request(app)
      .post('/support/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Need help', description: 'This is a valid description' });

    expect(res.status).toBe(201);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.ticket.ticketId).toBeDefined();
  });

  it('rejects oversized description with 400', async () => {
    const user = await User.create({ email: 'big@example.com', passwordHash: 'hash', name: 'Big User' });
    const token = jwt.sign({ userId: user._id.toString(), id: user._id.toString(), role: 'traveler' }, process.env.JWT_SECRET as string);

    // create description > 1000 chars
    const longDesc = 'a'.repeat(1200);

    const res = await request(app)
      .post('/support/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Long', description: longDesc });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
