import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { logger } from '../src/utils/logger';

// Allow overriding preset credentials via environment variables
const AGENT_NAME = process.env.PRESET_AGENT_NAME || 'Saksham Taneja';
const AGENT_EMAIL = process.env.PRESET_AGENT_EMAIL || 'trektribeagent@gmail.com';
const AGENT_PHONE = process.env.PRESET_AGENT_PHONE || '+919999999998';
const AGENT_PASSWORD = process.env.PRESET_AGENT_PASSWORD || 'Agent@9800';

const ADMIN_NAME = process.env.PRESET_ADMIN_NAME || 'Root Admin';
const ADMIN_EMAIL = process.env.PRESET_ADMIN_EMAIL || 'trektribe_root@trektribe.in';
const ADMIN_PHONE = process.env.PRESET_ADMIN_PHONE || '+919999999999';
const ADMIN_PASSWORD = process.env.PRESET_ADMIN_PASSWORD || 'Saksham@4700';

const DEMO_ORGANIZER_NAME = process.env.PRESET_DEMO_ORGANIZER_NAME || 'Saksham Taneja';
const DEMO_ORGANIZER_EMAIL = process.env.PRESET_DEMO_ORGANIZER_EMAIL || 'tanejasaksham44@gmail.com';
const DEMO_ORGANIZER_PHONE = process.env.PRESET_DEMO_ORGANIZER_PHONE || '+919876543210';
const DEMO_ORGANIZER_PASSWORD = process.env.PRESET_DEMO_ORGANIZER_PASSWORD || 'Demo@1234';

const PREMIUM_ORGANIZER_NAME = 'Saksham Taneja Premium';
const PREMIUM_ORGANIZER_EMAIL = 'sakshamtaneja098@gmail.com';
const PREMIUM_ORGANIZER_PHONE = '+919876543211';
const PREMIUM_ORGANIZER_PASSWORD = process.env.PREMIUM_ORGANIZER_PASSWORD || 'Premium@1234';

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
    bio: 'Premium organizer account with all features enabled',
    isEmailVerified: true,
    phoneVerified: true,
    profilePhoto: null,
    location: 'Delhi, India',
    firstOrganizerLogin: new Date(),
    autoPay: {
      isSetup: true,
      setupRequired: false,
      scheduledPaymentDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      amount: 149900,
      currency: 'INR',
      listingsIncluded: 100,
      isSetupCompleted: true,
      autoPayEnabled: true
    }
  },
  {
    name: PREMIUM_ORGANIZER_NAME,
    email: PREMIUM_ORGANIZER_EMAIL,
    phone: PREMIUM_ORGANIZER_PHONE,
    role: 'organizer' as const,
    password: PREMIUM_ORGANIZER_PASSWORD,
    bio: 'Primary Premium Organizer Account',
    isEmailVerified: true,
    phoneVerified: true,
    profilePhoto: null,
    location: 'Mumbai, India',
    firstOrganizerLogin: new Date(),
    autoPay: {
      isSetup: true,
      setupRequired: false,
      scheduledPaymentDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      amount: 149900,
      currency: 'INR',
      listingsIncluded: 1000,
      isSetupCompleted: true,
      autoPayEnabled: true
    }
  }
];

async function setupPresetUsers() {
  try {
    console.log('🔄 Connecting to database...');
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI environment variable is required');

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');

    for (const userData of presetUsers) {
      try {
        console.log(`Processing ${userData.role}: ${userData.email}...`);
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const existingUser = await User.findOne({ email: userData.email });

        if (existingUser) {
          console.log(`⚠️ User exists. FORCE UPDATING...`);
          const updateData: any = {
            passwordHash: hashedPassword,
            role: userData.role,
            name: userData.name,
            phone: userData.phone,
            bio: userData.bio,
            emailVerified: true,
            phoneVerified: true
          };

          if (userData.role === 'organizer') {
            updateData.location = (userData as any).location;
            updateData.firstOrganizerLogin = (userData as any).firstOrganizerLogin || new Date();
            updateData.organizerProfile = {
              bio: userData.bio,
              location: (userData as any).location,
              specialties: [],
              certifications: [],
              languages: [],
              qrCodes: [],
              autoPay: (userData as any).autoPay || {
                isSetupRequired: false,
                isSetupCompleted: false,
                autoPayEnabled: false
              }
            };
          }

          await User.findByIdAndUpdate(existingUser._id, updateData);
          console.log(`✅ FORCE UPDATED: ${userData.email}`);
        } else {
          const newUserData: any = {
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            passwordHash: hashedPassword,
            role: userData.role,
            bio: userData.bio,
            location: (userData as any).location || 'India',
            emailVerified: true,
            phoneVerified: true,
            profilePhoto: userData.profilePhoto
          };

          if (userData.role === 'organizer') {
            newUserData.firstOrganizerLogin = (userData as any).firstOrganizerLogin || new Date();
            newUserData.organizerProfile = {
              bio: userData.bio,
              specialties: [],
              certifications: [],
              languages: [],
              qrCodes: [],
              autoPay: (userData as any).autoPay || {
                isSetupRequired: false,
                isSetupCompleted: false,
                autoPayEnabled: false
              }
            };
          }

          const newUser = await User.create(newUserData);
          console.log(`✅ Created ${userData.role}: ${userData.email} (ID: ${newUser._id})`);
        }
      } catch (userError: any) {
        console.error(`❌ Error processing ${userData.email}:`, userError.message);
      }
    }

    console.log('\n🌟 Granting premium status to ALL existing organizers...');
    const result = await User.updateMany(
      { role: 'organizer' },
      {
        $set: {
          'organizerProfile.autoPay.autoPayEnabled': true,
          'organizerProfile.autoPay.isSetupCompleted': true,
          'organizerProfile.autoPay.isSetupRequired': false,
          'organizerProfile.autoPay.scheduledPaymentDate': new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        }
      }
    );
    console.log(`✅ Granted premium status to ${result.modifiedCount} organizers.`);

    console.log('\n' + '='.repeat(70));
    console.log('✅ Setup completed successfully!');
    console.log('='.repeat(70));
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to setup preset users:', error.message);
    process.exit(1);
  }
}

setupPresetUsers().catch(console.error);
