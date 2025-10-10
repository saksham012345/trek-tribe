#!/usr/bin/env tsx

import 'dotenv/config';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';

async function createSampleTrips() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the demo organizer
    const organizer = await User.findOne({ email: 'organizer@trektribe.in' });
    if (!organizer) {
      console.log('❌ Demo organizer not found. Please run create-root-user.ts first.');
      return;
    }

    const sampleTrips = [
      // Nature/Wildlife trips
      {
        title: 'Himalayan Nature Trek - Pristine Wilderness Experience',
        description: 'Explore the untouched beauty of the Himalayas through dense forests, alpine meadows, and pristine wilderness. Perfect for nature lovers and wildlife enthusiasts.',
        destination: 'Manali, Himachal Pradesh',
        price: 12500,
        capacity: 12,
        categories: ['Nature', 'Wildlife', 'Adventure', 'Mountain'],
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000), // 37 days from now
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.8,
        reviewCount: 15,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Forest Wildlife Safari - Jim Corbett National Park',
        description: 'Experience the thrill of spotting tigers, elephants, and diverse wildlife in their natural habitat. Includes guided nature walks and photography sessions.',
        destination: 'Jim Corbett, Uttarakhand',
        price: 8500,
        capacity: 8,
        categories: ['Wildlife', 'Nature', 'Photography'],
        startDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 48 * 24 * 60 * 60 * 1000),
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.6,
        reviewCount: 22,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Mountain Adventure Trek - Roopkund Lake',
        description: 'Challenge yourself with this high-altitude trek to the mysterious Roopkund Lake. Perfect for adventure seekers and mountain lovers.',
        destination: 'Roopkund, Uttarakhand',
        price: 18500,
        capacity: 10,
        categories: ['Mountain', 'Adventure', 'Trekking'],
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 68 * 24 * 60 * 60 * 1000),
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.9,
        reviewCount: 8,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Beach Paradise - Andaman Islands',
        description: 'Relax on pristine beaches, enjoy water sports, and explore the underwater world through snorkeling and scuba diving.',
        destination: 'Port Blair, Andaman Islands',
        price: 25500,
        capacity: 15,
        categories: ['Beach', 'Water', 'Adventure'],
        startDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.7,
        reviewCount: 31,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Cultural Heritage Tour - Rajasthan',
        description: 'Immerse yourself in the rich cultural heritage of Rajasthan. Visit magnificent palaces, ancient temples, and traditional markets.',
        destination: 'Jaipur-Jodhpur-Udaipur, Rajasthan',
        price: 15500,
        capacity: 20,
        categories: ['Cultural', 'Heritage', 'Historical'],
        startDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 46 * 24 * 60 * 60 * 1000),
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.5,
        reviewCount: 18,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        title: 'Extreme Adventure Sports - Rishikesh',
        description: 'Get your adrenaline pumping with white water rafting, bungee jumping, and other extreme sports in the adventure capital of India.',
        destination: 'Rishikesh, Uttarakhand',
        price: 7500,
        capacity: 16,
        categories: ['Adventure', 'Sports', 'Extreme'],
        startDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
        organizerId: organizer._id,
        status: 'active',
        averageRating: 4.4,
        reviewCount: 25,
        participants: [],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Check if trips already exist
    const existingTrips = await Trip.find({ organizerId: organizer._id });
    if (existingTrips.length > 0) {
      console.log(`⚠️ ${existingTrips.length} trips already exist for demo organizer`);
      console.log('Existing trips:');
      existingTrips.forEach(trip => {
        console.log(`  📍 ${trip.title} - ${trip.categories.join(', ')}`);
      });
      return;
    }

    // Create the sample trips
    const createdTrips = await Trip.insertMany(sampleTrips);
    console.log(`🎉 Created ${createdTrips.length} sample trips successfully!`);
    
    console.log('\n📍 SAMPLE TRIPS CREATED:');
    console.log('========================');
    createdTrips.forEach((trip, index) => {
      console.log(`${index + 1}. ${trip.title}`);
      console.log(`   📂 Categories: ${trip.categories.join(', ')}`);
      console.log(`   💰 Price: ₹${trip.price}`);
      console.log(`   ⭐ Rating: ${trip.averageRating} (${trip.reviewCount} reviews)`);
      console.log('');
    });

    console.log('🤖 AI OPTIMIZATION READY:');
    console.log('- Nature queries will find: Himalayan Nature Trek, Wildlife Safari');
    console.log('- Mountain queries will find: Himalayan Trek, Roopkund Trek');
    console.log('- Beach queries will find: Andaman Islands');
    console.log('- Cultural queries will find: Rajasthan Heritage Tour');
    console.log('- Adventure queries will find: Multiple adventure trips');

  } catch (error) {
    console.error('❌ Error creating sample trips:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  createSampleTrips();
}

export { createSampleTrips };