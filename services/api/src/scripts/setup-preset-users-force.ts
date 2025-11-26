import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

// Allow overriding preset credentials via environment variables
const AGENT_NAME = process.env.PRESET_AGENT_NAME || 'Saksham Taneja';
const AGENT_EMAIL = process.env.PRESET_AGENT_EMAIL || 'tanejasaksham44@gmail.com';
const AGENT_PHONE = process.env.PRESET_AGENT_PHONE || '+919999999998';
const AGENT_PASSWORD = process.env.PRESET_AGENT_PASSWORD || 'Agent@9800';

const ADMIN_NAME = process.env.PRESET_ADMIN_NAME || 'Root Admin';
const ADMIN_EMAIL = process.env.PRESET_ADMIN_EMAIL || 'trektribe_root@trektribe.in';
const ADMIN_PHONE = process.env.PRESET_ADMIN_PHONE || '+919999999999';
const ADMIN_PASSWORD = process.env.PRESET_ADMIN_PASSWORD || 'Saksham@4700';

// Demo Organizer for testing payments
const DEMO_ORGANIZER_NAME = process.env.PRESET_DEMO_ORGANIZER_NAME || 'Demo Organizer';
const DEMO_ORGANIZER_EMAIL = process.env.PRESET_DEMO_ORGANIZER_EMAIL || 'demo.organizer@trektribe.in';
const DEMO_ORGANIZER_PHONE = process.env.PRESET_DEMO_ORGANIZER_PHONE || '+919876543210';
const DEMO_ORGANIZER_PASSWORD = process.env.PRESET_DEMO_ORGANIZER_PASSWORD || 'Demo@1234';

const presetUsers = [
  {
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    phone: ADMIN_PHONE,
    role: 'admin' as const,
    password: ADMIN_PASSWORD,
    bio: 'Root Administrator for TrekTribe platform',
    isEmailVerified: true,
    phoneVerified: true,
    profilePhoto: null
  },
  {
    name: AGENT_NAME,
    email: AGENT_EMAIL,
    phone: AGENT_PHONE,
    role: 'agent' as const,
    password: AGENT_PASSWORD,
    bio: 'Customer Support Agent for TrekTribe',
    isEmailVerified: true,
    phoneVerified: true,
    profilePhoto: null
  },
  {
    name: DEMO_ORGANIZER_NAME,
    email: DEMO_ORGANIZER_EMAIL,
    phone: DEMO_ORGANIZER_PHONE,
    role: 'organizer' as const,
    password: DEMO_ORGANIZER_PASSWORD,
    bio: 'Demo organizer account for testing payment systems and auto-pay features',
    isEmailVerified: true,
    phoneVerified: true,
    profilePhoto: null,
    location: 'Delhi, India',
    // Set first organizer login to now for testing
    firstOrganizerLogin: new Date(),
  }
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
    console.log('');
    console.log('🔐 Using Environment Variables:');
    console.log(`   PRESET_ADMIN_EMAIL: ${process.env.PRESET_ADMIN_EMAIL || '(not set, using default)'}`);
    console.log(`   PRESET_ADMIN_PASSWORD: ${process.env.PRESET_ADMIN_PASSWORD ? '(set)' : '(not set, using default)'}`);
    console.log(`   PRESET_AGENT_EMAIL: ${process.env.PRESET_AGENT_EMAIL || '(not set, using default)'}`);
    console.log(`   PRESET_AGENT_PASSWORD: ${process.env.PRESET_AGENT_PASSWORD ? '(set)' : '(not set, using default)'}`);
    console.log('');

    console.log('🔄 Setting up preset users with FORCE UPDATE...');
    console.log('');

    for (const userData of presetUsers) {
      try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: userData.email });
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        
        if (existingUser) {
          console.log(`⚠️  User ${userData.email} already exists. FORCE UPDATING...`);
          
          const updateData: any = {
            passwordHash: hashedPassword,
            role: userData.role,
            bio: userData.bio,
            emailVerified: true,
            phoneVerified: true,
            phone: userData.phone,
            name: userData.name
          };

          // Add organizer-specific fields
          if (userData.role === 'organizer') {
            updateData.location = userData.location;
            updateData.firstOrganizerLogin = userData.firstOrganizerLogin;
            
            // Initialize organizerProfile if not exists
            if (!existingUser.organizerProfile) {
              updateData.organizerProfile = {
                bio: userData.bio,
                specialties: [],
                certifications: [],
                languages: [],
                qrCodes: []
              };
            }
          }
          
          await User.findByIdAndUpdate(existingUser._id, updateData);
          
          console.log(`✅ FORCE UPDATED ${userData.role}: ${userData.email}`);
          console.log(`   🔑 New Password Hash: ${hashedPassword.substring(0, 20)}...`);
          
          // Verify the password was updated correctly
          const verifyUser = await User.findById(existingUser._id);
          const passwordMatches = await bcrypt.compare(userData.password, verifyUser!.passwordHash);
          console.log(`   ✔️  Password verification: ${passwordMatches ? 'SUCCESS' : 'FAILED'}`);
          
        } else {
          // Create new user
          const newUserData: any = {
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            passwordHash: hashedPassword,
            role: userData.role,
            bio: userData.bio,
            location: userData.location || 'India',
            emailVerified: true,
            phoneVerified: true,
            profilePhoto: userData.profilePhoto
          };

          // Add organizer-specific fields
          if (userData.role === 'organizer') {
            newUserData.firstOrganizerLogin = userData.firstOrganizerLogin;
            newUserData.organizerProfile = {
              bio: userData.bio,
              specialties: [],
              certifications: [],
              languages: [],
              qrCodes: []
            };
          }
          
          const newUser = await User.create(newUserData);
          
          console.log(`✅ Created ${userData.role}: ${userData.email} (ID: ${newUser._id})`);
        }
        
        console.log(`   📧 Email: ${userData.email}`);
        console.log(`   🔒 Password: ${userData.password}`);
        console.log(`   👤 Role: ${userData.role}`);
        console.log(`   📱 Phone: ${userData.phone}`);
        console.log('');
      } catch (error: any) {
        console.error(`❌ Failed to setup user ${userData.email}:`, error.message);
      }
    }

    // Display login information
    console.log('');
    console.log('='.repeat(70));
    console.log('🎯 PRESET USER CREDENTIALS (UPDATED)');
    console.log('='.repeat(70));
    console.log('');
    
    console.log('🔐 ADMIN LOGIN:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   Phone: ${ADMIN_PHONE}`);
    console.log('   Access: Admin Dashboard, Full System Control');
    console.log('');
    
    console.log('🎧 AGENT LOGIN:');
    console.log(`   Email: ${AGENT_EMAIL}`);
    console.log(`   Password: ${AGENT_PASSWORD}`);
    console.log(`   Phone: ${AGENT_PHONE}`);
    console.log('   Access: Agent Dashboard, CRM, Support Tickets');
    console.log('');

    console.log('🏔️  DEMO ORGANIZER LOGIN (FOR PAYMENT TESTING):');
    console.log(`   Email: ${DEMO_ORGANIZER_EMAIL}`);
    console.log(`   Password: ${DEMO_ORGANIZER_PASSWORD}`);
    console.log(`   Phone: ${DEMO_ORGANIZER_PHONE}`);
    console.log('   Access: Organizer Dashboard, Trip Management');
    console.log('');
    
    console.log('='.repeat(70));
    console.log('✅ All preset users have been FORCE UPDATED successfully!');
    console.log('');
    console.log('🧪 TESTING:');
    console.log('   Try logging in now with the credentials above.');
    console.log('   If you set environment variables, those values are being used.');
    console.log('   Otherwise, the default values shown above are in effect.');
    console.log('');
    console.log('⚠️  IMPORTANT: Change these passwords in production!');
    console.log('='.repeat(70));
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to setup preset users:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the setup
setupPresetUsers().catch(console.error);
