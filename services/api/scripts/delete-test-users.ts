/**
 * Delete Test Users from Database
 * 
 * This script removes test user accounts that were created during development/testing
 * to ensure no test credentials remain in the production database.
 */

import mongoose from 'mongoose';
import { User } from '../src/models/User';
import * as dotenv from 'dotenv';

dotenv.config();

const TEST_USER_EMAILS = [
  'admin@trektribe.in',
  'crm.test@trektribe.in',
  'crm.manager@trektribe.in',
  'test@example.com',
  'organizer@example.com',
  'admin@example.com',
  // Add any other test emails you want to remove
];

async function deleteTestUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is required');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    console.log('🗑️  Deleting test users...\n');

    for (const email of TEST_USER_EMAILS) {
      const user = await User.findOne({ email });
      
      if (user) {
        await User.deleteOne({ email });
        console.log(`✅ Deleted: ${email} (${user.role})`);
      } else {
        console.log(`⏭️  Not found: ${email}`);
      }
    }

    console.log('\n✅ Test user cleanup completed!');
    
    // Show remaining users count
    const remainingUsers = await User.countDocuments();
    console.log(`\n📊 Remaining users in database: ${remainingUsers}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
deleteTestUsers();
