import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const DEMO_ORGANIZER = {
  name: 'Demo Organizer',
  email: 'demo.organizer@trektribe.in',
  phone: '+91-9876543210',
  password: 'DemoOrg@2025!',
  role: 'organizer',
  bio: 'Demo organizer with CRM access for testing',
  isEmailVerified: true
};

async function createDemoOrganizer() {
  try {
    console.log('🔄 Connecting to database...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database');

    console.log('🔄 Creating demo organizer...');

    // Check if organizer already exists
    let user = await User.findOne({ email: DEMO_ORGANIZER.email });
    
    if (user) {
      console.log(`⚠️  Organizer ${DEMO_ORGANIZER.email} already exists. Updating...`);
      
      // Update password and ensure correct role
      const hashedPassword = await bcrypt.hash(DEMO_ORGANIZER.password, 10);
      user = await User.findByIdAndUpdate(user._id, {
        passwordHash: hashedPassword,
        role: 'organizer',
        bio: DEMO_ORGANIZER.bio,
        emailVerified: true,
        name: DEMO_ORGANIZER.name,
        phone: DEMO_ORGANIZER.phone
      }, { new: true });
      
      console.log(`✅ Updated organizer: ${DEMO_ORGANIZER.email}`);
    } else {
      // Create new organizer user
      const hashedPassword = await bcrypt.hash(DEMO_ORGANIZER.password, 10);
      
      user = await User.create({
        name: DEMO_ORGANIZER.name,
        email: DEMO_ORGANIZER.email,
        phone: DEMO_ORGANIZER.phone,
        passwordHash: hashedPassword,
        role: 'organizer',
        bio: DEMO_ORGANIZER.bio,
        location: 'Mumbai, India',
        emailVerified: true,
        profilePhoto: null
      });
      
      console.log(`✅ Created organizer: ${DEMO_ORGANIZER.email} (ID: ${user._id})`);
    }
    
    console.log('');
    console.log('🎯 DEMO ORGANIZER CREDENTIALS:');
    console.log('='.repeat(60));
    console.log('');
    console.log('🏢 ORGANIZER LOGIN (with CRM Access):');
    console.log(`   Email: ${DEMO_ORGANIZER.email}`);
    console.log(`   Password: ${DEMO_ORGANIZER.password}`);
    console.log(`   User ID: ${user._id}`);
    console.log('   Role: organizer');
    console.log('   CRM Access: ✅ Enabled');
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Demo organizer created successfully!');
    console.log('');
    console.log('📝 You can now:');
    console.log('   - Login with these credentials');
    console.log('   - Access CRM features at /api/crm/*');
    console.log('   - Create and manage leads');
    console.log('   - View trip bookings and analytics');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to create demo organizer:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the setup
createDemoOrganizer().catch(console.error);
