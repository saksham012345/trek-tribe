import 'dotenv/config';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { User } from '../models/User';
import { aiSupportService } from '../services/aiSupportService';

async function main() {
  let mongod: MongoMemoryServer | null = null;
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory MongoDB');

    const user = await User.create({
      name: 'Direct Ticket User',
      email: `direct.user.${Date.now()}@example.com`,
      passwordHash: 'hashed-password-placeholder',
      role: 'traveler',
      isVerified: true,
    } as any);
    console.log('👤 Seeded user:', user._id.toString());

    const ticketId = await aiSupportService.createSupportTicket(
      user._id.toString(),
      'Payment Issue During Booking',
      'Unable to upload UPI screenshot. Please assist.',
      'booking'
    );

    console.log('🎫 Created ticket ID:', ticketId);
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error creating ticket directly:', err?.message || err);
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
      if (mongod) await mongod.stop();
    } catch {}
  }
}

main();
