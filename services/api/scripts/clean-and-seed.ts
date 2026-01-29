#!/usr/bin/env tsx
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';
import { Follow } from '../models/Follow';
import { Post } from '../models/Post';
import UserActivity from '../models/UserActivity';
import { Wishlist } from '../models/Wishlist';
import { Comment } from '../models/Comment';

// Preset user credentials
const PRESET_USERS = [
  {
    name: 'Admin User',
    email: 'admin@trektribe.com',
    phone: '+91-9876543210',
    role: 'admin' as const,
    password: 'Admin@2025',
    bio: '🛡️ Platform Administrator - Managing TrekTribe operations',
    location: 'Mumbai, India',
  },
  {
    name: 'Support Agent',
    email: 'agent@trektribe.com',
    phone: '+91-9876543211',
    role: 'agent' as const,
    password: 'Agent@2025',
    bio: '🎯 Customer Support Agent - Here to help travelers',
    location: 'Bangalore, India',
  },
  {
    name: 'Demo Organizer',
    email: 'organizer@trektribe.com',
    phone: '+91-9876543212',
    role: 'organizer' as const,
    password: 'Organizer@2025',
    bio: '🗺️ Professional Trek Organizer - Creating amazing mountain experiences',
    location: 'Manali, India',
  },
  {
    name: 'Demo Traveler',
    email: 'traveler@trektribe.com',
    phone: '+91-9876543213',
    role: 'traveler' as const,
    password: 'Traveler@2025',
    bio: '⛰️ Adventure Enthusiast - Always ready for the next trek',
    location: 'Delhi, India',
  },
];

async function cleanDatabase() {
  console.log('\n🗑️  Cleaning database...');
  
  // Get all collections from the database
  const collections = await mongoose.connection.db.listCollections().toArray();
  
  for (const collection of collections) {
    try {
      await mongoose.connection.db.collection(collection.name).deleteMany({});
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`   ✅ Cleaned ${collection.name} (${count} remaining)`);
    } catch (error: any) {
      console.log(`   ⚠️  ${collection.name}: ${error.message}`);
    }
  }
}

async function seedUsers() {
  console.log('\n👥 Creating preset users...');
  
  const createdUsers = [];

  for (const userData of PRESET_USERS) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        passwordHash: hashedPassword,
        role: userData.role,
        bio: userData.bio,
        location: userData.location,
        emailVerified: true,
        phoneVerified: true,
        isVerified: true,
        socialStats: {
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
        },
      });

      createdUsers.push(user);
      
      console.log(`   ✅ Created ${userData.role}: ${userData.email}`);
      console.log(`      👤 Name: ${userData.name}`);
      console.log(`      🔒 Password: ${userData.password}`);
      console.log(`      📱 Phone: ${userData.phone}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create ${userData.email}: ${error.message}`);
    }
  }

  return createdUsers;
}

async function cleanAndSeed() {
  try {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   TrekTribe Database Clean & Seed Tool    ║');
    console.log('╚════════════════════════════════════════════╝');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('❌ MONGODB_URI environment variable is required');
    }

    console.log('\n🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Warning
    console.log('\n⚠️  WARNING: This will DELETE ALL DATA from the database!');
    console.log('⏳ Starting in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Clean all collections
    await cleanDatabase();

    // Seed preset users
    const users = await seedUsers();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║          Database Reset Complete!          ║');
    console.log('╚════════════════════════════════════════════╝');
    
    console.log('\n📋 Login Credentials:');
    console.log('─────────────────────────────────────────────');
    PRESET_USERS.forEach(user => {
      console.log(`\n${user.role.toUpperCase()}:`);
      console.log(`  📧 Email: ${user.email}`);
      console.log(`  🔒 Password: ${user.password}`);
    });
    console.log('\n─────────────────────────────────────────────');
    
    console.log('\n✨ You can now login with any of these accounts!');
    console.log('🌐 Frontend: http://localhost:3000');
    console.log('🔧 Backend: http://localhost:4000');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  cleanAndSeed();
}

export { cleanAndSeed };
