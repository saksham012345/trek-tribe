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
    const allTrips = await Trip.find({}).populate('organizerId', 'name email');
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
      console.log(`   👤 Organizer: ${(trip.organizerId as any)?.name || 'Unknown'}`);
      console.log(`   📅 ${new Date(trip.startDate).toLocaleDateString()} - ${new Date(trip.endDate).toLocaleDateString()}`);
      console.log(`   📊 Status: ${trip.status}`);
      console.log(`   🆔 ID: ${trip._id}`);
    });

    // Option to delete all trips (commented out for safety)
    /*
    console.log('\n⚠️  Would you like to delete all trips? This action cannot be undone!');
    console.log('Uncomment the deletion code below if you want to proceed.');
    
    const result = await Trip.deleteMany({});
    console.log(`\n✅ Deleted ${result.deletedCount} trips from database`);
    console.log('Database is now clean!');
    */

    console.log('\n💡 To delete all trips, uncomment the deletion code in the script and run again.');
    console.log('   This ensures only user-created trips will be visible in the app.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupTestTrips();
