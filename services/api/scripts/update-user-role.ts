import mongoose from 'mongoose';
import { User } from '../models/User';
import * as dotenv from 'dotenv';

dotenv.config();

async function updateUserRole(email: string, newRole: 'traveler' | 'organizer' | 'admin' | 'agent') {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/trek-tribe';
    await mongoose.connect(MONGO_URI);
    
    console.log('🔌 Connected to database');
    console.log(`🔍 Looking for user with email: ${email}`);
    
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log(`❌ User with email ${email} not found`);
      console.log('\nAvailable users:');
      const allUsers = await User.find({}).select('email name role');
      allUsers.forEach(u => {
        console.log(`  - ${u.email} (${u.name}) - Current role: ${u.role}`);
      });
      process.exit(1);
    }
    
    console.log(`✅ Found user: ${user.name} (${user.email})`);
    console.log(`📝 Current role: ${user.role}`);
    
    user.role = newRole;
    
    // If upgrading to organizer, initialize organizer profile
    if (newRole === 'organizer' && !user.organizerProfile) {
      user.organizerProfile = {
        bio: 'Experienced trek organizer',
        experience: '1 year of experience',
        specialties: ['Trekking', 'Adventure'],
        yearsOfExperience: 1,
        totalTripsOrganized: 0,
        qrCodes: [],
        businessInfo: {
          companyName: user.name
        }
      };
    }
    
    await user.save();
    
    console.log(`✅ User role updated to: ${newRole}`);
    
    if (newRole === 'organizer') {
      console.log('\n⚠️  IMPORTANT: As an organizer, you need to:');
      console.log('1. Upload at least one payment QR code from your profile settings');
      console.log('2. Complete your organizer profile details');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user role:', error);
    process.exit(1);
  }
}

// Get email and role from command line arguments
const email = process.argv[2];
const role = process.argv[3] as 'traveler' | 'organizer' | 'admin' | 'agent';

if (!email || !role) {
  console.log('Usage: npm run update-role <email> <role>');
  console.log('Example: npm run update-role user@example.com organizer');
  console.log('\nAvailable roles: traveler, organizer, admin, agent');
  process.exit(1);
}

if (!['traveler', 'organizer', 'admin', 'agent'].includes(role)) {
  console.log('❌ Invalid role. Must be one of: traveler, organizer, admin, agent');
  process.exit(1);
}

updateUserRole(email, role);
