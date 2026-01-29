import 'dotenv/config';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Ensure in-memory DB mode for index import checks
process.env.USE_MEM_DB = process.env.USE_MEM_DB || 'true';
process.env.DISABLE_EMAIL = process.env.DISABLE_EMAIL || 'true';
process.env.DISABLE_AUTO_START = 'true';

// Satisfy JWT secret requirement
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'dev-local-jwt-secret-key-that-is-long-enough-2025';
}

// Import app after env setup
import { User } from '../models/User';
import { MongoMemoryServer } from 'mongodb-memory-server';

async function main() {
  let mongod: MongoMemoryServer | null = null;
  try {
    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');

    // Seed a user
    const user = await User.create({
      name: 'Local Tester',
      email: `local.tester.${Date.now()}@example.com`,
      passwordHash: 'hashed-password-placeholder',
      role: 'traveler',
      isVerified: true,
    } as any);
    console.log('👤 Seeded user:', user._id.toString());

    // Issue JWT
    const token = jwt.sign(
      { userId: user._id.toString(), role: 'traveler' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Import app after env + DB are ready (avoid auto-start)
    const { default: app } = await import('../index');

    // Call the create-ticket endpoint
    const payload = {
      subject: 'Booking Help Needed',
      description: 'Having trouble completing the payment step.',
      category: 'booking',
      urgency: 'normal',
    };

    const res = await request(app)
      .post('/api/chat/create-ticket')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    console.log('📨 Response status:', res.status);
    console.log('📦 Response body:', JSON.stringify(res.body, null, 2));

    if (res.status === 200 && res.body?.success) {
      console.log('✅ Ticket created successfully. Ticket ID:', res.body.data?.ticketId);
      process.exit(0);
    } else {
      console.error('❌ Ticket creation failed.');
      process.exit(1);
    }
  } catch (err: any) {
    console.error('❌ Error running localCreateTicket:', err?.message || err);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      if (mongod) await mongod.stop();
    } catch {}
  }
}

main();
