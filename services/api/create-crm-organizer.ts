import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'trektribe_root@trektribe.in';

// Define schemas inline
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  firstName: String,
  lastName: String,
  phone: String,
  role: { type: String, enum: ['admin', 'organizer', 'traveler', 'agent'], default: 'organizer' },
  avatar: String,
  emailVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

const organizerProfileSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  businessName: String,
  location: String,
  yearsOfExperience: Number,
  tripsOrganized: Number,
  specialties: [String],
  languages: [String],
  certifications: [String],
  bio: String,
  profilePicture: String,
  rating: Number,
  reviewCount: Number,
});

const crmSubscriptionSchema = new mongoose.Schema({
  organizerId: mongoose.Schema.Types.ObjectId,
  planType: { type: String, enum: ['trip_package_5', 'trip_package_10', 'trip_package_20', 'trip_package_50', 'crm_bundle', 'trial'] },
  status: { type: String, enum: ['active', 'expired', 'cancelled', 'pending_payment'] },
  
  // CRM Access Bundle
  crmBundle: {
    hasAccess: Boolean,
    price: Number,
    features: [String],
  },
  
  payments: [{
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    transactionId: String,
    amount: Number,
    currency: String,
    paymentMethod: String,
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'] },
    paidAt: Date,
    metadata: mongoose.Schema.Types.Mixed,
  }],
  
  notifications: {
    trialEndingIn7Days: Boolean,
    trialEndingIn1Day: Boolean,
    trialExpired: Boolean,
    paymentReminder: Boolean,
    lastReminderSentAt: Date,
  },
  
  startDate: Date,
  endDate: Date,
  expiryReminderSent: Boolean,
  
  billingHistory: [{
    date: Date,
    amount: Number,
    description: String,
    invoiceUrl: String,
  }],
  
  autoRenew: Boolean,
  cancelledAt: Date,
  cancellationReason: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema);
const OrganizerProfile = mongoose.model('OrganizerProfile', organizerProfileSchema);
const CRMSubscription = mongoose.model('CRMSubscription', crmSubscriptionSchema);

async function createCRMOrganizer() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    console.log('\n🎬 CREATING CRM ACCESS ORGANIZER ACCOUNT\n');
    console.log('================================================\n');

    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Create User
    console.log('👤 Step 1: Creating CRM Organizer User...');
    const email = 'crm.manager@trektribe.in';
    const password = 'CRMAccess@2025!';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      passwordHash: hashedPassword,
      name: 'CRM Manager',
      firstName: 'CRM',
      lastName: 'Manager',
      phone: '+919876543210',
      role: 'organizer',
      emailVerified: true,
    });
    console.log(`✅ Created: ${email}\n`);

    // Create Organizer Profile
    console.log('📋 Step 2: Creating Organizer Profile...');
    const profile = await OrganizerProfile.create({
      userId: user._id,
      businessName: 'TrekTribe CRM Management',
      location: 'Bangalore, India',
      yearsOfExperience: 12,
      tripsOrganized: 150,
      specialties: ['CRM Management', 'Customer Relations', 'Trip Coordination', 'Group Management'],
      languages: ['English', 'Hindi', 'Kannada'],
      certifications: ['CRM Specialist', 'Customer Service Expert', 'Business Management'],
      bio: 'Professional CRM manager for TrekTribe. Manages customer relationships and trip coordination.',
      rating: 4.9,
      reviewCount: 200,
    });
    console.log('✅ Created organizer profile\n');

    // Create CRM Subscription
    console.log('💳 Step 3: Creating CRM Bundle Subscription...');
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90); // 90 days of CRM access

    const crmSubscription = await CRMSubscription.create({
      organizerId: user._id,
      planType: 'crm_bundle',
      status: 'active',
      
      // CRM Bundle with full features
      crmBundle: {
        hasAccess: true,
        price: 2100,
        features: [
          'Customer Management System',
          'Booking Management',
          'Customer Communication Tools',
          'Trip Scheduling & Coordination',
          'Traveler Database',
          'Communication History',
          'Customer Support Dashboard',
          'Analytics & Reports',
          'Email Integration',
          'SMS Notifications',
          'Group Management Tools',
          'Feedback Collection',
          'Customer Segmentation',
          'Payment Tracking',
          'Document Management',
        ],
      },
      
      // Mark first payment as completed
      payments: [
        {
          transactionId: `CRM-${Date.now()}`,
          amount: 2100,
          currency: 'INR',
          paymentMethod: 'credit_card',
          status: 'completed',
          paidAt: now,
          razorpayOrderId: 'order_' + Math.random().toString(36).substring(7),
          razorpayPaymentId: 'pay_' + Math.random().toString(36).substring(7),
        },
      ],
      
      notifications: {
        trialEndingIn7Days: false,
        trialEndingIn1Day: false,
        trialExpired: false,
        paymentReminder: false,
      },
      
      startDate: now,
      endDate,
      expiryReminderSent: false,
      
      billingHistory: [
        {
          date: now,
          amount: 2100,
          description: 'CRM Bundle - 90 days access',
          invoiceUrl: '#',
        },
      ],
      
      autoRenew: true,
    });
    console.log('✅ Created CRM bundle subscription\n');

    console.log('================================================\n');
    console.log('✨ CRM ACCESS ORGANIZER ACCOUNT READY!\n');

    console.log('🔐 LOGIN CREDENTIALS:\n');
    console.log(`📧 Email:    ${email}`);
    console.log(`🔒 Password: ${password}`);
    console.log(`📱 Phone:    +919876543210\n`);

    console.log('💳 CRM SUBSCRIPTION STATUS:\n');
    console.log('✅ Status:           ACTIVE (CRM Bundle)');
    console.log('📅 Plan:             CRM Management Bundle (₹2,100)');
    console.log(`⏰ Access Period:    ${now.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    console.log('⏳ Days Remaining:   90 days');
    console.log('🔄 Auto-Renewal:     Enabled\n');

    console.log('📊 ORGANIZER PROFILE:\n');
    console.log('👤 Name:             CRM Manager');
    console.log('🏢 Business:         TrekTribe CRM Management');
    console.log('🌍 Location:         Bangalore, India');
    console.log('📈 Years Experience: 12 years');
    console.log('✈️  Trips Organized:  150');
    console.log('🏆 Rating:           4.9/5 (200 reviews)');
    console.log('🗣️  Languages:        English, Hindi, Kannada');
    console.log('🎯 Specialties:      CRM Management, Customer Relations, Trip Coordination, Group Management');
    console.log('🏅 Certifications:   CRM Specialist, Customer Service Expert, Business Management\n');

    console.log('================================================\n');
    console.log('🎯 CRM BUNDLE FEATURES:\n');
    crmSubscription.crmBundle?.features.forEach(feature => {
      console.log(`✅ ${feature}`);
    });

    console.log('\n================================================');
    console.log('Ready for CRM management! 🎬\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

createCRMOrganizer();
