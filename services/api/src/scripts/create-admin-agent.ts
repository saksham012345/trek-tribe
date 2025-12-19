import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// Admin and Agent credentials
const adminAndAgents = [
  {
    name: 'Admin User',
    email: 'admin@trektribe.com',
    password: 'Admin@123456',
    role: 'admin' as const,
    bio: 'Platform administrator with full access'
  },
  {
    name: 'Support Agent',
    email: 'agent@trektribe.com',
    password: 'Agent@123456',
    role: 'agent' as const,
    bio: 'Customer support specialist'
  },
  {
    name: 'Senior Agent',
    email: 'agent2@trektribe.com',
    password: 'Agent2@123456',
    role: 'agent' as const,
    bio: 'Senior customer support specialist'
  }
];

async function createAdminAndAgents() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n👥 Creating Admin and Agent users...');
    
    for (const userData of adminAndAgents) {
      // Check if user already exists
      const existing = await User.findOne({ email: userData.email });
      
      if (existing) {
        console.log(`⚠️  User ${userData.email} already exists, skipping...`);
        continue;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 12);

      // Create user
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash,
        role: userData.role,
        bio: userData.bio,
        emailVerified: true, // Auto-verify admin and agents
        phoneVerified: false,
        lastActive: new Date()
      });

      console.log(`✅ Created ${userData.role}: ${userData.name} (${userData.email})`);
      console.log(`   Password: ${userData.password}`);
    }

    console.log('\n✨ Admin and Agent users created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('═══════════════════════════════════════════');
    adminAndAgents.forEach(u => {
      console.log(`${u.role.toUpperCase()}: ${u.email} / ${u.password}`);
    });
    console.log('═══════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

createAdminAndAgents();
