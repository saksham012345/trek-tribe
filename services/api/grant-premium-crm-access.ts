/**
 * Grant CRM Access to Premium Organizer Account
 * This script enables CRM access for organizer.premium@trektribe.com
 * 
 * Usage: npx ts-node grant-premium-crm-access.ts
 */

import mongoose from 'mongoose';
import { User } from './src/models/User';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
const PREMIUM_ORGANIZER_EMAIL = 'organizer.premium@trektribe.com';

async function grantCRMAccess() {
  try {
    console.log('🎬 GRANTING CRM ACCESS TO PREMIUM ORGANIZER\n');
    console.log('================================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Find the premium organizer
    console.log(`🔍 Finding organizer: ${PREMIUM_ORGANIZER_EMAIL}...`);
    const organizer = await User.findOne({ email: PREMIUM_ORGANIZER_EMAIL });

    if (!organizer) {
      console.error(`❌ Organizer not found: ${PREMIUM_ORGANIZER_EMAIL}`);
      console.log('💡 Please run setup-demo-database.ts first to create the organizer account.');
      await mongoose.disconnect();
      process.exit(1);
    }

    console.log(`✅ Found organizer: ${organizer.name}\n`);

    // Update organizer profile to enable CRM access
    console.log('🔧 Enabling CRM access in organizer profile...');
    
    // Ensure organizerProfile exists
    if (!organizer.organizerProfile) {
      organizer.organizerProfile = {};
    }

    // Enable CRM access flags
    (organizer.organizerProfile as any).crmEnabled = true;
    (organizer.organizerProfile as any).crmAccess = true;

    await organizer.save();
    console.log('✅ CRM access enabled successfully!\n');

    console.log('================================================\n');
    console.log('✨ CRM ACCESS GRANTED!\n');
    console.log(`📧 Email:    ${PREMIUM_ORGANIZER_EMAIL}`);
    console.log(`👤 Name:     ${organizer.name}`);
    console.log(`🔐 CRM Access: ENABLED\n`);
    console.log('================================================\n');
    console.log('✅ The organizer can now access the CRM dashboard!\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  grantCRMAccess();
}

export default grantCRMAccess;

