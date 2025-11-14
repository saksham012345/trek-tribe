import mongoose from 'mongoose';
import { User } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

async function checkOrganizerQR() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the organizer
    const organizerId = '68e91c35971ff3e6e73b2e44';
    const organizer = await User.findById(organizerId);
    
    if (!organizer) {
      console.error('❌ Organizer not found');
      process.exit(1);
    }

    console.log('\n📋 Organizer details:');
    console.log('  Name:', organizer.name);
    console.log('  Email:', organizer.email);
    console.log('  Role:', organizer.role);
    
    const qrCodes = organizer.organizerProfile?.qrCodes || [];
    console.log('\n💳 QR Codes:', qrCodes.length);
    
    if (qrCodes.length === 0) {
      console.log('\n⚠️  No QR codes found. Adding a dummy QR code...');
      
      if (!organizer.organizerProfile) {
        organizer.organizerProfile = {
          bio: '',
          specialties: [],
          certifications: [],
          languages: [],
          qrCodes: []
        };
      }
      
      // Add a dummy QR code
      organizer.organizerProfile.qrCodes = [{
        filename: 'dummy-qr.png',
        originalName: 'payment-qr.png',
        path: '/uploads/qr/dummy-qr.png',
        paymentMethod: 'UPI',
        description: 'Primary payment QR code',
        uploadedAt: new Date(),
        isActive: true
      }];
      
      await organizer.save();
      console.log('✅ Dummy QR code added successfully');
    } else {
      console.log('✅ QR codes already present:');
      qrCodes.forEach((qr: any, index: number) => {
        console.log(`  ${index + 1}. ${qr.paymentMethod} - ${qr.description || 'No description'} (Active: ${qr.isActive !== false})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

checkOrganizerQR();
