import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Allow overriding preset agent credentials via environment variables (recommended for production)
const AGENT_NAME = process.env.PRESET_AGENT_NAME || 'Saksham Taneja';
const AGENT_EMAIL = process.env.PRESET_AGENT_EMAIL || 'tanejasaksham44@gmail.com';
const AGENT_PHONE = process.env.PRESET_AGENT_PHONE || '+91-9999999998';
const AGENT_PASSWORD = process.env.PRESET_AGENT_PASSWORD || 'Agent@4700';

// Admin overrides
const ADMIN_NAME = process.env.PRESET_ADMIN_NAME || 'Root Admin';
const ADMIN_EMAIL = process.env.PRESET_ADMIN_EMAIL || 'trektribe_root@trektribe.in';
const ADMIN_PHONE = process.env.PRESET_ADMIN_PHONE || '+91-9999999999';
const ADMIN_PASSWORD = process.env.PRESET_ADMIN_PASSWORD || 'Admin@4700';

const presetUsers = [
  {
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    role: 'admin',
    password: ADMIN_PASSWORD,
    bio: 'Root Administrator for TrekTribe platform',
    isEmailVerified: true,
    profilePhoto: null
  },
  {
    name: AGENT_NAME,
    email: AGENT_EMAIL,
    phone: AGENT_PHONE,
    role: 'agent',
    password: AGENT_PASSWORD,
    bio: 'Customer Support Agent for TrekTribe',
    isEmailVerified: true,
    profilePhoto: null
  },
];

async function setupPresetUsers() {
  try {
    console.log('🔄 Connecting to database...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');

    console.log('🔄 Setting up preset users...');

    for (const userData of presetUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists. Updating password...`);
          
          // Update password and ensure correct role
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          await User.findByIdAndUpdate(existingUser._id, {
            passwordHash: hashedPassword,
            role: userData.role,
            bio: userData.bio,
            emailVerified: true
          });
          
          console.log(`✅ Updated ${userData.role}: ${userData.email}`);
        } else {
          // Create new user
          const hashedPassword = await bcrypt.hash(userData.password, 10);
          
          const newUser = await User.create({
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            passwordHash: hashedPassword,
            role: userData.role,
            bio: userData.bio,
            location: 'India',
            emailVerified: true,
            profilePhoto: userData.profilePhoto
          });
          
          console.log(`✅ Created ${userData.role}: ${userData.email} (ID: ${newUser._id})`);
        }
        
        console.log(`   📧 Email: ${userData.email}`);
        console.log(`   🔒 Password: ${userData.password}`);
        console.log(`   👤 Role: ${userData.role}`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to setup user ${userData.email}:`, error.message);
      }
    }

    // Display login information
    console.log('🎯 PRESET USER CREDENTIALS:');
    console.log('='.repeat(50));
    console.log('');
    
    console.log('🔐 ADMIN LOGIN:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('   Access: /admin/dashboard');
    console.log('');
    
    console.log('🎧 AGENT LOGIN:');
    console.log(`   Email: ${AGENT_EMAIL}`);
    console.log(`   Password: ${AGENT_PASSWORD}`);
    console.log('   Access: /agent/dashboard');
    console.log('');
    
    console.log('='.repeat(50));
    console.log('✅ All preset users have been setup successfully!');
    console.log('⚠️  Please change these passwords in production!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to setup preset users:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupPresetUsers().catch(console.error);