#!/usr/bin/env tsx
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

async function verifyUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const email = 'admin@trektribe.com';
    const testPassword = 'Admin@2025';

    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found!');
      process.exit(1);
    }

    console.log('\n📋 User Details:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Phone Verified: ${user.phoneVerified}`);
    console.log(`   Password Hash: ${user.passwordHash?.substring(0, 20)}...`);

    console.log('\n🔒 Testing Password:');
    console.log(`   Test Password: ${testPassword}`);
    
    const isMatch = await bcrypt.compare(testPassword, user.passwordHash);
    console.log(`   Password Match: ${isMatch ? '✅ YES' : '❌ NO'}`);
    
    if (!isMatch) {
      console.log('\n🔍 Debugging:');
      const testHash = await bcrypt.hash(testPassword, 10);
      console.log(`   Fresh hash of test password: ${testHash.substring(0, 20)}...`);
      console.log(`   Stored hash in database: ${user.passwordHash?.substring(0, 20)}...`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

verifyUser();
