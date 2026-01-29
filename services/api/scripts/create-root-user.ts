#!/usr/bin/env tsx

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

async function createRootUser() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Root admin credentials
    const rootEmail = 'trektribe_root@trektribe.in';
    const rootPassword = 'TrekTribe@2024!Root';

    // Check if root user already exists
    const existingRoot = await User.findOne({ email: rootEmail });
    if (existingRoot) {
      console.log('⚠️ Root user already exists');
      console.log(`Email: ${rootEmail}`);
      console.log(`Password: ${rootPassword}`);
      return;
    }

    // Create root admin user
    const passwordHash = await bcrypt.hash(rootPassword, 10);
    const rootUser = await User.create({
      email: rootEmail,
      name: 'Trek Tribe Root Admin',
      passwordHash,
      role: 'admin',
      isVerified: true,
      phone: '+91-9999999999',
      bio: 'Root administrator account for Trek Tribe platform.',
      location: 'India',
      createdAt: new Date(),
      lastActive: new Date()
    });

    console.log('🎉 Root admin user created successfully!');
    console.log(`📧 Email: ${rootEmail}`);
    console.log(`🔑 Password: ${rootPassword}`);
    console.log(`👤 User ID: ${rootUser._id}`);
    console.log(`🛡️ Role: ${rootUser.role}`);

    // Create agent support user
    const agentEmail = 'tanejasaksham44@gmail.com';
    const agentPassword = 'Agent@2024!Support';

    const existingAgent = await User.findOne({ email: agentEmail });
    if (!existingAgent) {
      const agentPasswordHash = await bcrypt.hash(agentPassword, 10);
      const agentUser = await User.create({
        email: agentEmail,
        name: 'Saksham Taneja',
        passwordHash: agentPasswordHash,
        role: 'agent',
        isVerified: true,
        phone: '+91-8888888888',
        bio: 'Customer support agent for Trek Tribe platform.',
        location: 'Delhi, India',
        createdAt: new Date(),
        lastActive: new Date()
      });

      console.log('🎯 Agent support user created successfully!');
      console.log(`📧 Email: ${agentEmail}`);
      console.log(`🔑 Password: ${agentPassword}`);
      console.log(`👤 User ID: ${agentUser._id}`);
      console.log(`🛡️ Role: ${agentUser.role}`);
    } else {
      console.log('⚠️ Agent user already exists');
      console.log(`Email: ${agentEmail}`);
      console.log(`Password: ${agentPassword}`);
    }

    // Create sample organizer
    const organizerEmail = 'organizer@trektribe.in';
    const organizerPassword = 'Organizer@2024!Demo';

    const existingOrganizer = await User.findOne({ email: organizerEmail });
    if (!existingOrganizer) {
      const organizerPasswordHash = await bcrypt.hash(organizerPassword, 10);
      const organizerUser = await User.create({
        email: organizerEmail,
        name: 'Demo Trip Organizer',
        passwordHash: organizerPasswordHash,
        role: 'organizer',
        isVerified: true,
        phone: '+91-7777777777',
        bio: 'Experienced trip organizer specializing in Himalayan treks and nature expeditions.',
        location: 'Manali, Himachal Pradesh',
        organizerProfile: {
          bio: 'Professional trekking guide with 8+ years of experience in organizing safe and memorable outdoor adventures.',
          experience: 'Specialized in high-altitude treks, wildlife safaris, and cultural tours across India.',
          specialties: ['Himalayan Treks', 'Wildlife Photography', 'Cultural Tours', 'Adventure Sports'],
          languages: ['Hindi', 'English', 'Punjabi'],
          yearsOfExperience: 8,
          certifications: ['Wilderness First Aid', 'Mountain Guide Certification']
        },
        createdAt: new Date(),
        lastActive: new Date()
      });

      console.log('🗺️ Demo organizer user created successfully!');
      console.log(`📧 Email: ${organizerEmail}`);
      console.log(`🔑 Password: ${organizerPassword}`);
      console.log(`👤 User ID: ${organizerUser._id}`);
      console.log(`🛡️ Role: ${organizerUser.role}`);
    } else {
      console.log('⚠️ Demo organizer user already exists');
      console.log(`Email: ${organizerEmail}`);
      console.log(`Password: ${organizerPassword}`);
    }

    console.log('\n📝 CREDENTIALS SUMMARY:');
    console.log('========================');
    console.log(`🛡️ ROOT ADMIN: ${rootEmail} | ${rootPassword}`);
    console.log(`🎯 AGENT: ${agentEmail} | ${agentPassword}`);
    console.log(`🗺️ ORGANIZER: ${organizerEmail} | ${organizerPassword}`);
    console.log('========================');

  } catch (error) {
    console.error('❌ Error creating users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  createRootUser();
}

export { createRootUser };