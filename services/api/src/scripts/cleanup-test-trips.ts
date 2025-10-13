import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';

async function cleanupTestTrips() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    // Get all trips
    const allTrips = await Trip.find({});
    console.log(`\nFound ${allTrips.length} trips in database:`);
    
    if (allTrips.length === 0) {
      console.log('✅ Database is clean - no trips found!');
      return;
    }

    // Display all trips
    allTrips.forEach((trip, index) => {
      console.log(`\n${index + 1}. ${trip.title}`);
      console.log(`   📍 ${trip.destination}`);
      console.log(`   💰 ₹${trip.price}`);
      console.log(`   👤 Organizer ID: ${trip.organizerId}`);
      console.log(`   📅 ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}`);
      console.log(`   📊 Status: ${trip.status}`);
      console.log(`   🆔 ID: ${trip._id}`);
    });

    // Delete all trips
    console.log('\n⚠️  Deleting all trips from database...');
    
    const result = await Trip.deleteMany({});
    console.log(`\n✅ Deleted ${result.deletedCount} trips from database`);
    console.log('Database is now clean!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupTestTrips();
