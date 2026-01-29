#!/usr/bin/env tsx

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * SECURE DATABASE RESET SCRIPT
 * 
 * This script will:
 * 1. Delete ALL existing users from the database
 * 2. Create a secure admin user
 * 3. Create a secure agent user
 * 
 * ⚠️ WARNING: This will permanently delete all user data!
 * Use only for testing and development purposes.
 */

// New secure credentials
const ADMIN_EMAIL = 'admin@trektribe.com';
const ADMIN_PASSWORD = 'SecureAdmin@2024';
const ADMIN_NAME = 'TrekTribe Admin';
const ADMIN_PHONE = '+919876543210';

const AGENT_EMAIL = 'agent@trektribe.com';
const AGENT_PASSWORD = 'SecureAgent@2024';
const AGENT_NAME = 'TrekTribe Support Agent';
const AGENT_PHONE = '+919876543211';

async function secureResetUsers() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    console.log('\n⚠️  WARNING: This will DELETE ALL USERS from the database!');
    console.log('⏳ Starting in 3 seconds...\n');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 1: Delete all existing users
    console.log('🗑️  Deleting all existing users...');
    const deleteResult = await User.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} users from database\n`);

    // Step 2: Create secure admin user
    console.log('👑 Creating secure admin user...');
    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const adminUser = await User.create({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash: adminPasswordHash,
      role: 'admin',
      phone: ADMIN_PHONE,
      phoneVerified: true, // Admin doesn't need phone verification
      emailVerified: true,
      isVerified: true,
      bio: 'Platform Administrator - Full System Access',
      location: 'India',
      lastActive: new Date()
    });
    console.log('✅ Admin user created successfully!');
    console.log(`   ID: ${adminUser._id}`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Role: admin\n`);

    // Step 3: Create secure agent user
    console.log('🎧 Creating secure agent user...');
    const agentPasswordHash = await bcrypt.hash(AGENT_PASSWORD, 10);
    const agentUser = await User.create({
      email: AGENT_EMAIL,
      name: AGENT_NAME,
      passwordHash: agentPasswordHash,
      role: 'agent',
      phone: AGENT_PHONE,
      phoneVerified: true, // Agent doesn't need phone verification
      emailVerified: true,
      isVerified: true,
      bio: 'Customer Support Agent - CRM & Ticket Management',
      location: 'India',
      lastActive: new Date()
    });
    console.log('✅ Agent user created successfully!');
    console.log(`   ID: ${agentUser._id}`);
    console.log(`   Email: ${AGENT_EMAIL}`);
    console.log(`   Password: ${AGENT_PASSWORD}`);
    console.log(`   Role: agent\n`);

    // Display final summary
    console.log('═'.repeat(60));
    console.log('✨ SECURE USER SETUP COMPLETE\n');
    console.log('🔐 LOGIN CREDENTIALS:\n');
    console.log('👑 ADMIN ACCESS:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Dashboard: /admin/dashboard\n`);
    
    console.log('🎧 AGENT ACCESS:');
    console.log(`   Email: ${AGENT_EMAIL}`);
    console.log(`   Password: ${AGENT_PASSWORD}`);
    console.log(`   Dashboard: /agent/dashboard\n`);
    
    console.log('📝 NOTES:');
    console.log('   • All previous users have been deleted');
    console.log('   • New users can register as travelers or organizers');
    console.log('   • Admin can create additional agents via: POST /api/auth/create-agent');
    console.log('   • Change these passwords immediately in production!');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    logger.error('Secure reset users failed', { error: error.message });
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  secureResetUsers();
}

export { secureResetUsers };
