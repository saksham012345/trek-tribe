/**
 * Create a Premium Organizer account with active subscription
 * This creates an organizer who has already purchased the premium plan
 */

import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { User } from './src/models/User';
import { OrganizerSubscription } from './src/models/OrganizerSubscription';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';

const PREMIUM_ORGANIZER = {
  name: 'Rajesh Adventure Tours',
  email: 'rajesh.tours@trektribe.in',
  password: 'Premium@2025!',
  phone: '+919123456789',
};

async function createPremiumOrganizerAccount() {
  try {
    console.log('🎬 CREATING PREMIUM ORGANIZER ACCOUNT\n');
    console.log('================================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Step 1: Create or update organizer user
    console.log('👤 Step 1: Creating Premium Organizer User...');
    let organizer = await User.findOne({ email: PREMIUM_ORGANIZER.email });

    if (!organizer) {
      const hashedPassword = await bcryptjs.hash(PREMIUM_ORGANIZER.password, 10);
      organizer = new User({
        name: PREMIUM_ORGANIZER.name,
        email: PREMIUM_ORGANIZER.email,
        passwordHash: hashedPassword,
        phone: PREMIUM_ORGANIZER.phone,
        role: 'organizer',
        verified: true,
        emailVerified: true,
        phoneVerified: true,
        location: 'Dehradun, India',
        bio: 'Premium organizer with active subscription - adventure trips specialist',
        organizerProfile: {
          yearsOfExperience: 8,
          totalTripsOrganized: 45,
          specialties: ['Trekking', 'Camping', 'Mountain Expeditions'],
          languages: ['English', 'Hindi'],
          certifications: ['Mountain Guide Certified', 'First Aid'],
        },
      });
      await organizer.save();
      console.log(`✅ Created: ${PREMIUM_ORGANIZER.email}\n`);
    } else {
      console.log(`✅ User exists: ${PREMIUM_ORGANIZER.email}\n`);
    }

    // Step 2: Create active premium subscription
    console.log('💳 Step 2: Creating Active Premium Subscription...');

    // Check if subscription already exists
    let subscription = await OrganizerSubscription.findOne({ organizerId: organizer._id });

    if (!subscription) {
      // Create new premium subscription
      const now = new Date();
      const expiryDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now

      subscription = new OrganizerSubscription({
        organizerId: organizer._id,
        plan: 'pro', // Premium plan
        status: 'active',
        isTrialActive: false,
        trialStartDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), // Started 120 days ago
        trialEndDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // Ended 60 days ago
        subscriptionStartDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000), // Paid 60 days ago
        subscriptionEndDate: expiryDate,
        currentPeriodStart: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: expiryDate,
        tripsPerCycle: 5,
        tripsUsed: 2, // Already used 2 trip slots
        tripsRemaining: 3,
        tripUsageHistory: [
          {
            tripId: new mongoose.Types.ObjectId(),
            tripTitle: 'Rishikesh Adventure Retreat',
            createdAt: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000),
            status: 'active',
          },
          {
            tripId: new mongoose.Types.ObjectId(),
            tripTitle: 'Himalayan Trekking Expedition',
            createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
            status: 'active',
          },
        ],
        pricePerCycle: 239900, // ₹2,399
        currency: 'INR',
        payments: [
          {
            amount: 239900,
            currency: 'INR',
            paymentMethod: 'razorpay',
            transactionId: 'PAY_' + Date.now(),
            paymentDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
            status: 'completed',
          },
        ],
        totalPaid: 239900,
        lastPaymentDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        nextPaymentDue: expiryDate,
        autoRenew: true,
        notificationsSent: [],
      });

      await subscription.save();
      console.log(`✅ Created premium subscription\n`);
    } else {
      console.log(`✅ Subscription exists: ${subscription.status}\n`);
    }

    console.log('================================================\n');
    console.log('✨ PREMIUM ORGANIZER ACCOUNT READY!\n');
    console.log('🔐 LOGIN CREDENTIALS:\n');
    console.log(`📧 Email:    ${PREMIUM_ORGANIZER.email}`);
    console.log(`🔒 Password: ${PREMIUM_ORGANIZER.password}`);
    console.log(`📱 Phone:    ${PREMIUM_ORGANIZER.phone}\n`);

    console.log('💳 SUBSCRIPTION STATUS:\n');
    console.log('✅ Status:            ACTIVE (Premium)');
    console.log('📅 Plan:              Pro (₹2,399/60 days)');
    console.log('🎫 Trips Available:   3 remaining (5 total)');
    console.log('🏆 Trips Created:     2');
    console.log('⏰ Renewal Date:      ' + subscription.subscriptionEndDate?.toLocaleDateString());
    console.log('🔄 Auto-Renewal:      Enabled\n');

    console.log('📊 ORGANIZER PROFILE:\n');
    console.log(`👤 Name:              ${PREMIUM_ORGANIZER.name}`);
    console.log(`🌍 Location:          Dehradun, India`);
    console.log(`📈 Years Experience: 8 years`);
    console.log(`✈️  Trips Organized:  45`);
    console.log(`🎯 Specialties:       Trekking, Camping, Mountain Expeditions`);
    console.log(`🗣️  Languages:        English, Hindi`);
    console.log(`🏅 Certifications:   Mountain Guide, First Aid\n`);

    console.log('================================================\n');
    console.log('🎯 FEATURES AVAILABLE:\n');
    console.log('✅ Create unlimited trips (5 per billing cycle)');
    console.log('✅ Advanced analytics dashboard');
    console.log('✅ Priority customer support');
    console.log('✅ Custom branding options');
    console.log('✅ Group booking management');
    console.log('✅ Payment tracking and reports\n');

    console.log('================================================');
    console.log('Ready for presentation! 🎬\n');

    await mongoose.disconnect();
    console.log('✅ Database connection closed\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createPremiumOrganizerAccount();
