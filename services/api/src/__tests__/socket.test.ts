import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Client from 'socket.io-client';
import jwt from 'jsonwebtoken';
import app from '../index';
import { createServer } from 'http';
import { socketService } from '../services/socketService';
import { User } from '../models/User';

let mongoServer: MongoMemoryServer;
let httpServer: any;
let url: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-long-enough-1234567890';
  // Only connect if not already connected (setup.ts may have connected us)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }

  const server = createServer(app as any);
  socketService.initialize(server);
  httpServer = server.listen(0);
  const port = (httpServer.address() as any).port;
  url = `http://localhost:${port}`;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  httpServer.close();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Socket.IO auth handshake', () => {
  it('rejects connection without token', (done) => {
    const client = Client(url, { transports: ['websocket'], forceNew: true });
    client.on('connect_error', (err: any) => {
      expect(err).toBeDefined();
      client.close();
      done();
    });
  });

  it('accepts connection with valid token', async (done) => {
    const user = await User.create({ email: 'socket@example.com', passwordHash: 'hash', name: 'Socket User' });
    const token = jwt.sign({ userId: user._id.toString(), id: user._id.toString(), role: 'traveler' }, process.env.JWT_SECRET as string);

    const client = Client(url, { transports: ['websocket'], forceNew: true, extraHeaders: { Authorization: `Bearer ${token}` } } as any);
    client.on('connect', () => {
      client.close();
      done();
    });
    client.on('connect_error', (err: any) => {
      client.close();
      done(err);
    });
  });
});
