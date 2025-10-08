import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { logger } from '../utils/logger';

const presetUsers = [
  {
    name: 'Admin User',
    email: 'admin@trekktribe.com',
    phone: '+91-9999999999',
    role: 'admin',
    password: 'Admin@123',
    bio: 'System Administrator for TrekTribe platform',
    isEmailVerified: true,
    profilePhoto: null
  },
  {
    name: 'Support Agent',
    email: 'agent@trekktribe.com',
    phone: '+91-9999999998',
    role: 'agent',
    password: 'Agent@123',
    bio: 'Customer Support Agent for TrekTribe',
    isEmailVerified: true,
    profilePhoto: null
  },
  {
    name: 'Demo Organizer',
    email: 'organizer@trekktribe.com',
    phone: '+91-9999999997',
    role: 'organizer',
    password: 'Organizer@123',
    bio: 'Demo Trek Organizer - Ready to create amazing adventures!',
    location: 'Mumbai, India',
    isEmailVerified: true,
    profilePhoto: null,
    organizerProfile: {
      companyName: 'Adventure Trails Co.',
      experience: '5+ years',
      specialization: ['Himalayan Treks', 'Adventure Sports', 'Wildlife Safaris'],
      certifications: ['Wilderness First Aid', 'Trek Leader Certification'],
      languages: ['Hindi', 'English', 'Marathi'],
      emergencyContact: '+91-9999999997'
    }
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
            isEmailVerified: true,
            ...(userData.organizerProfile && { organizerProfile: userData.organizerProfile })
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
            location: userData.location || 'India',
            isEmailVerified: userData.isEmailVerified,
            profilePhoto: userData.profilePhoto,
            ...(userData.organizerProfile && { organizerProfile: userData.organizerProfile })
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
    console.log('   Email: admin@trekktribe.com');
    console.log('   Password: Admin@123');
    console.log('   Access: /admin/dashboard');
    console.log('');
    
    console.log('🎧 AGENT LOGIN:');
    console.log('   Email: agent@trekktribe.com');
    console.log('   Password: Agent@123');
    console.log('   Access: /agent/dashboard');
    console.log('');
    
    console.log('🏔️  ORGANIZER LOGIN:');
    console.log('   Email: organizer@trekktribe.com');
    console.log('   Password: Organizer@123');
    console.log('   Access: /organizer/dashboard');
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