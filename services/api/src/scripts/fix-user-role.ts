import mongoose from 'mongoose';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

async function fixUserRole() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find user by ID from the JWT token
    const userId = '691188417d8c8d4d7b14c42e'; // From the JWT token
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.error('❌ User not found with ID:', userId);
      process.exit(1);
    }

    console.log('📋 Current user details:');
    console.log('  Name:', user.name);
    console.log('  Email:', user.email);
    console.log('  Current Role:', user.role);

    // Update role to organizer
    user.role = 'organizer';
    
    // Initialize organizerProfile if it doesn't exist
    if (!user.organizerProfile) {
      user.organizerProfile = {
        bio: '',
        specialties: [],
        certifications: [],
        languages: [],
        yearsOfExperience: 0,
        totalTripsOrganized: 0,
        achievements: [],
        qrCodes: []
      };
    }

    await user.save();
    
    console.log('✅ User role updated to:', user.role);
    console.log('✅ Organizer profile initialized');
    console.log('\n⚠️  IMPORTANT: The user needs to log in again to get a new JWT token with the updated role.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

fixUserRole();
