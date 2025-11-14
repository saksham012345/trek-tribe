import mongoose from 'mongoose';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

async function generateOrganizerToken() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find an organizer user (using the first one from the list)
    const organizer = await User.findOne({ role: 'organizer' });
    
    if (!organizer) {
      console.error('❌ No organizer found in database');
      process.exit(1);
    }

    console.log('\n📋 Organizer details:');
    console.log('  ID:', organizer._id);
    console.log('  Name:', organizer.name);
    console.log('  Email:', organizer.email);
    console.log('  Role:', organizer.role);

    // Generate JWT token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('❌ JWT_SECRET not found in environment');
      process.exit(1);
    }

    const token = jwt.sign(
      {
        userId: organizer._id.toString(),
        role: organizer.role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
      },
      secret
    );

    console.log('\n✅ JWT Token Generated:\n');
    console.log(token);
    console.log('\n📝 Use this token in your Authorization header:');
    console.log(`Bearer ${token}`);
    console.log('\n⏰ Token expires in 7 days');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

generateOrganizerToken();
