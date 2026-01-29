import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import chatSupportRoutes from '../routes/chatSupportRoutes';

// Ensure services stay idle (no auto-start server)
process.env.DISABLE_AUTO_START = 'true';
process.env.USE_MEM_DB = 'true';
process.env.MONGODB_URI = '';
process.env.DISABLE_EMAIL = 'true';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'dev-local-jwt-secret-key-that-is-long-enough-2025';
}

async function main() {
  let mongod: MongoMemoryServer | null = null;
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB for chat widget test');

    const { User } = await import('../models/User');

    // Build a minimal app with the chat routes only to avoid auto-start logic
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatSupportRoutes);

    const user = await User.create({
      name: 'Widget User',
      email: `widget.user.${Date.now()}@example.com`,
      passwordHash: 'hashed-password-placeholder',
      role: 'traveler',
      isVerified: true,
    } as any);
    console.log('👤 Seeded user:', user._id.toString());

    const token = jwt.sign(
      { userId: user._id.toString(), role: 'traveler' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    const payload = {
      subject: 'Need human agent from widget',
      description: 'Payment failing on checkout, please connect me to an agent.',
      category: 'booking',
      urgency: 'high'
    };

    const res = await request(app)
      .post('/api/chat/create-ticket')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    console.log('📨 Status:', res.status);
    console.log('📦 Body:', JSON.stringify(res.body, null, 2));

    if (res.status !== 200 || !res.body?.success) {
      throw new Error('Chat widget ticket creation failed');
    }

    console.log('✅ Chat widget ticket creation verified. Ticket ID:', res.body.data?.ticketId);
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Test failed:', err?.message || err);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      if (mongod) await mongod.stop();
    } catch {}
  }
}

main();
