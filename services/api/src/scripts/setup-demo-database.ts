/**
 * Complete Database Setup Script
 * Creates demo users with various subscription levels for testing
 */

import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { Trip } from '../models/Trip';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trekk-tribe';

async function setupDemoDatabase() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('\n🗑️  Cleaning existing data...');
    await User.deleteMany({});
    await OrganizerSubscription.deleteMany({});
    await Trip.deleteMany({});
    console.log('✅ Database cleaned');

    console.log('\n👥 Creating demo users...');

    // =================================================================
    // 1. ADMIN USER
    // =================================================================
    const adminPassword = await bcrypt.hash('Admin@123456', 12);
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@trektribe.com',
      passwordHash: adminPassword,
      role: 'admin',
      emailVerified: true,
      phoneNumber: '+919999999991',
      bio: 'Platform Administrator',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Admin created: admin@trektribe.com / Admin@123456');

    // =================================================================
    // 2. AGENT USER
    // =================================================================
    const agentPassword = await bcrypt.hash('Agent@123456', 12);
    const agent = await User.create({
      name: 'Support Agent',
      email: 'agent@trektribe.com',
      passwordHash: agentPassword,
      role: 'agent',
      emailVerified: true,
      phoneNumber: '+919999999992',
      bio: 'Customer Support Agent',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Agent created: agent@trektribe.com / Agent@123456');

    // =================================================================
    // 3. ORGANIZER WITH PREMIUM SUBSCRIPTION (CRM Access)
    // =================================================================
    const org1Password = await bcrypt.hash('Organizer@123', 12);
    const organizerPremium = await User.create({
      name: 'Premium Organizer',
      email: 'organizer.premium@trektribe.com',
      passwordHash: org1Password,
      role: 'organizer',
      emailVerified: true,
      phoneNumber: '+919876543210',
      bio: 'Professional trek organizer with premium subscription',
      organizerProfile: {
        organizationName: 'Himalayan Adventures',
        verified: true,
        rating: 4.8,
        totalTrips: 5,
        experience: '10 years organizing treks in Himalayas',
        specializations: ['High Altitude', 'Winter Expeditions', 'Photography Treks'],
        certifications: ['Wilderness First Aid', 'Mountain Guide Level 2'],
        qrCodes: [] // Empty for demo - organizer can add later
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Premium Organizer created: organizer.premium@trektribe.com / Organizer@123');

    // Create Premium subscription with CRM access
    const premiumSub = await OrganizerSubscription.create({
      organizerId: organizerPremium._id,
      plan: 'pro',
      status: 'active',
      tripsPerCycle: 15,
      tripsUsed: 5,
      pricePerCycle: 3999,
      currency: 'INR',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      isTrialActive: false,
      trialStartDate: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000), // Trial was 70 days ago
      trialEndDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // Ended 10 days ago
      autoRenew: true,
      totalPaid: 3999,
      lastPaymentDate: new Date(),
      tripUsageHistory: [],
      payments: [
        {
          amount: 3999,
          currency: 'INR',
          paymentMethod: 'razorpay',
          transactionId: 'txn_demo_001',
          paymentDate: new Date(),
          status: 'completed'
        }
      ],
      notificationsSent: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`✅ Premium subscription created: ${premiumSub.tripsUsed}/${premiumSub.tripsPerCycle} trips used`);

    // Create sample trips for premium organizer
    const sampleTrips = [
      {
        title: 'Hampta Pass Trek - Premium',
        description: 'A stunning crossover trek from Kullu to Lahaul valley, offering diverse landscapes from lush green valleys to barren cold deserts.',
        destination: 'Manali, Himachal Pradesh',
        categories: ['Adventure', 'Trekking', 'Mountain'],
        price: 12500,
        capacity: 15,
        participants: [],
        startDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        minimumAge: 16,
        difficulty: 'Moderate',
        schedule: [
          { day: 1, title: 'Manali to Chika', activities: ['Drive to Chika', 'Acclimatization walk', 'Camp setup'] },
          { day: 2, title: 'Chika to Balu Ka Ghera', activities: ['Morning trek', 'River crossing', 'Camp at Balu Ka Ghera'] },
          { day: 3, title: 'Balu Ka Ghera to Hampta Pass', activities: ['Summit attempt', 'Descend to Shea Goru', 'Camp setup'] },
          { day: 4, title: 'Shea Goru to Chatru', activities: ['Trek to Chatru', 'Drive to Manali'] }
        ],
        images: [
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
          'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b'
        ],
        paymentConfig: {
          paymentType: 'advance',
          advanceAmount: 5000,
          paymentMethods: ['upi', 'card', 'netbanking'],
          collectionMode: 'razorpay',
          verificationMode: 'automated',
          refundPolicy: '50% refund if cancelled 7 days before trek',
          instructions: 'Pay advance to confirm booking. Balance due 3 days before trek start.'
        },
        status: 'active',
        verificationStatus: 'approved',
        organizerId: organizerPremium._id
      },
      {
        title: 'Kedarkantha Winter Trek',
        description: 'Experience the magic of snow-capped peaks and pristine winter landscapes on this beautiful Himalayan trek.',
        destination: 'Sankri, Uttarakhand',
        categories: ['Adventure', 'Trekking', 'Winter', 'Snow'],
        price: 9500,
        capacity: 20,
        participants: [],
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
        minimumAge: 14,
        difficulty: 'Easy to Moderate',
        schedule: [
          { day: 1, title: 'Dehradun to Sankri', activities: ['Drive to Sankri', 'Evening briefing'] },
          { day: 2, title: 'Sankri to Juda Ka Talab', activities: ['Trek through pine forests', 'Camp at Juda Ka Talab'] },
          { day: 3, title: 'Juda Ka Talab to Kedarkantha Base', activities: ['Trek to base camp', 'Sunset views'] },
          { day: 4, title: 'Summit Day', activities: ['Early morning summit', 'Descend to Hargaon'] },
          { day: 5, title: 'Hargaon to Sankri', activities: ['Trek down', 'Drive to Dehradun'] }
        ],
        images: [
          'https://images.unsplash.com/photo-1519904981063-b0cf448d479e',
          'https://images.unsplash.com/photo-1506905925346-21bda4d32df4'
        ],
        paymentConfig: {
          paymentType: 'full',
          paymentMethods: ['upi', 'card'],
          collectionMode: 'razorpay',
          verificationMode: 'automated'
        },
        status: 'active',
        verificationStatus: 'approved',
        organizerId: organizerPremium._id
      }
    ];

    for (const tripData of sampleTrips) {
      const trip = await Trip.create(tripData);
      console.log(`✅ Sample trip created: ${trip.title}`);
    }

    // =================================================================
    // 4. ORGANIZER WITHOUT SUBSCRIPTION
    // =================================================================
    const org2Password = await bcrypt.hash('Organizer@123', 12);
    const organizerBasic = await User.create({
      name: 'Basic Organizer',
      email: 'organizer.basic@trektribe.com',
      passwordHash: org2Password,
      role: 'organizer',
      emailVerified: true,
      phoneNumber: '+919876543211',
      bio: 'New trek organizer exploring the platform',
      organizerProfile: {
        organizationName: 'Trek Explorers',
        verified: false,
        rating: 0,
        totalTrips: 0,
        experience: '2 years organizing local treks',
        specializations: ['Weekend Treks', 'Beginners'],
        certifications: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Basic Organizer created: organizer.basic@trektribe.com / Organizer@123');
    console.log('   (No subscription - will need to activate trial/paid plan)');

    // =================================================================
    // 5. TRAVELER USER
    // =================================================================
    const travelerPassword = await bcrypt.hash('Traveler@123', 12);
    const traveler = await User.create({
      name: 'Adventure Traveler',
      email: 'traveler@trektribe.com',
      passwordHash: travelerPassword,
      role: 'traveler',
      emailVerified: true,
      phoneNumber: '+919876543212',
      bio: 'Passionate about mountains and adventure travel',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log('✅ Traveler created: traveler@trektribe.com / Traveler@123');

    // =================================================================
    // SUMMARY
    // =================================================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ DEMO DATABASE SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log('\n📋 LOGIN CREDENTIALS:\n');
    console.log('1️⃣  ADMIN');
    console.log('   Email: admin@trektribe.com');
    console.log('   Password: Admin@123456');
    console.log('   Access: Full platform access\n');

    console.log('2️⃣  AGENT');
    console.log('   Email: agent@trektribe.com');
    console.log('   Password: Agent@123456');
    console.log('   Access: Customer support & ticket management\n');

    console.log('3️⃣  PREMIUM ORGANIZER (With CRM Access)');
    console.log('   Email: organizer.premium@trektribe.com');
    console.log('   Password: Organizer@123');
    console.log('   Subscription: PREMIUM (15 trips/cycle)');
    console.log('   Trips Used: 5/15');
    console.log('   CRM Access: ✅ YES');
    console.log('   Sample Trips: 2 created\n');

    console.log('4️⃣  BASIC ORGANIZER (No Subscription)');
    console.log('   Email: organizer.basic@trektribe.com');
    console.log('   Password: Organizer@123');
    console.log('   Subscription: ❌ NONE');
    console.log('   Status: Needs to activate trial or paid plan\n');

    console.log('5️⃣  TRAVELER');
    console.log('   Email: traveler@trektribe.com');
    console.log('   Password: Traveler@123');
    console.log('   Access: Browse trips, book, chat\n');

    console.log('='.repeat(60));
    console.log('🎯 TESTING SCENARIOS:');
    console.log('='.repeat(60));
    console.log('• Test subscription gating: Login as basic organizer → Try creating trip');
    console.log('• Test CRM access: Login as premium organizer → Access /crm/leads');
    console.log('• Test trip limits: Premium organizer can create 10 more trips');
    console.log('• Test booking: Login as traveler → Browse & book trips');
    console.log('• Test admin: Login as admin → Access all features');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error setting up database:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  }
}

// Run the setup
setupDemoDatabase();
