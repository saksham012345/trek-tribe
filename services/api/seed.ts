#!/usr/bin/env node

/**
 * Database Seeding Script for Trek Tribe
 * 
 * Purpose: Create test data for development and testing
 * Usage: node seed.js --type=leads --count=50
 *        node seed.js --type=subscriptions --count=10
 *        node seed.js --type=all --count=10
 * 
 * Environment: Requires MONGODB_URI to be set
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const seedType = args.find(a => a.startsWith('--type='))?.split('=')[1] || 'all';
const seedCount = parseInt(args.find(a => a.startsWith('--count='))?.split('=')[1] || '10');

console.log(`🌱 Trek Tribe Database Seeding Script`);
console.log(`📊 Type: ${seedType}, Count: ${seedCount}`);
console.log('----------------------------------------');

// Schema definitions
const organizerSubscriptionSchema = new mongoose.Schema({
  userId: String,
  planType: String,
  price: Number,
  trips: Number,
  crmAccess: Boolean,
  leadCapture: Boolean,
  phoneNumbers: Boolean,
  status: String,
  paymentId: String,
  createdAt: Date,
  expiresAt: Date,
  autoRenew: Boolean,
});

const leadSchema = new mongoose.Schema({
  organizerId: String,
  name: String,
  email: String,
  phone: String,
  tripId: String,
  tripName: String,
  status: String,
  verified: Boolean,
  verifiedAt: Date,
  source: String,
  leadScore: Number,
  notes: String,
  createdAt: Date,
  updatedAt: Date,
});

const paymentSchema = new mongoose.Schema({
  userId: String,
  amount: Number,
  currency: String,
  planType: String,
  paymentId: String,
  orderId: String,
  status: String,
  method: String,
  failureReason: String,
  createdAt: Date,
});

const userActivitySchema = new mongoose.Schema({
  userId: String,
  userType: String,
  activityType: String,
  description: String,
  metadata: mongoose.Schema.Types.Mixed,
  createdAt: Date,
});

// Models
const OrganizerSubscription = mongoose.model('OrganizerSubscription', organizerSubscriptionSchema, 'organizersubscriptions');
const Lead = mongoose.model('Lead', leadSchema, 'leads');
const Payment = mongoose.model('Payment', paymentSchema, 'payments');
const UserActivity = mongoose.model('UserActivity', userActivitySchema, 'useractivity');

// ============================================
// SEEDING FUNCTIONS
// ============================================

/**
 * Generate test subscription data
 */
function generateSubscription(organizerId: string) {
  const plans = [
    { type: 'STARTER', price: 599, trips: 2, crm: false },
    { type: 'BASIC', price: 1299, trips: 4, crm: false },
    { type: 'PROFESSIONAL', price: 2199, trips: 6, crm: true },
    { type: 'PREMIUM', price: 3999, trips: 15, crm: true },
    { type: 'ENTERPRISE', price: 9999, trips: 100, crm: true },
  ];

  const plan = plans[Math.floor(Math.random() * plans.length)];

  return {
    userId: organizerId,
    planType: plan.type,
    price: plan.price,
    trips: plan.trips,
    crmAccess: plan.crm,
    leadCapture: plan.crm,
    phoneNumbers: plan.crm,
    status: 'active',
    paymentId: `pay_${faker.string.alphaNumeric(14)}`,
    createdAt: faker.date.past({ years: 1 }),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    autoRenew: faker.datatype.boolean(),
  };
}

/**
 * Generate test lead data
 */
function generateLead(organizerId: string, tripId: string, tripName: string) {
  const statuses = ['new', 'contacted', 'interested', 'qualified', 'lost'];
  const sources = ['organic', 'paid_ad', 'referral', 'social_media', 'direct'];

  return {
    organizerId,
    name: faker.person.fullName(),
    email: faker.internet.email(),
    phone: faker.phone.number('91##########').substring(0, 10), // Indian phone numbers
    tripId,
    tripName,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    verified: Math.random() > 0.7,
    verifiedAt: Math.random() > 0.7 ? faker.date.past({ years: 0.5 }) : null,
    source: sources[Math.floor(Math.random() * sources.length)],
    leadScore: Math.floor(Math.random() * 100),
    notes: faker.lorem.sentence(),
    createdAt: faker.date.past({ years: 0.5 }),
    updatedAt: faker.date.recent({ days: 30 }),
  };
}

/**
 * Generate test payment data
 */
function generatePayment(userId: string) {
  const plans = [
    { type: 'STARTER', price: 599 },
    { type: 'BASIC', price: 1299 },
    { type: 'PROFESSIONAL', price: 2199 },
    { type: 'PREMIUM', price: 3999 },
    { type: 'ENTERPRISE', price: 9999 },
  ];

  const plan = plans[Math.floor(Math.random() * plans.length)];
  const statuses = ['completed', 'pending', 'failed'];
  const status = statuses[Math.floor(Math.random() * (Math.random() > 0.1 ? 1 : statuses.length))];

  return {
    userId,
    amount: plan.price,
    currency: 'INR',
    planType: plan.type,
    paymentId: `pay_${faker.string.alphaNumeric(14)}`,
    orderId: `order_${faker.string.alphaNumeric(14)}`,
    status,
    method: faker.helpers.arrayElement(['card', 'upi', 'netbanking', 'wallet']),
    failureReason: status === 'failed' ? faker.lorem.word() : null,
    createdAt: faker.date.past({ years: 0.5 }),
  };
}

/**
 * Generate test activity data
 */
function generateActivity(userId: string) {
  const activityTypes = [
    { type: 'trip_creation', description: 'Created a new trip' },
    { type: 'trip_view', description: 'Viewed trip details' },
    { type: 'lead_creation', description: 'Created a new lead' },
    { type: 'lead_update', description: 'Updated lead status' },
    { type: 'payment_completed', description: 'Completed payment' },
    { type: 'subscription_upgrade', description: 'Upgraded subscription' },
    { type: 'crm_access', description: 'Accessed CRM dashboard' },
  ];

  const activity = activityTypes[Math.floor(Math.random() * activityTypes.length)];

  return {
    userId,
    userType: 'organizer',
    activityType: activity.type,
    description: activity.description,
    metadata: { timestamp: new Date() },
    createdAt: faker.date.past({ years: 0.5 }),
  };
}

// ============================================
// DATABASE OPERATIONS
// ============================================

/**
 * Seed subscriptions
 */
async function seedSubscriptions(count: number) {
  console.log(`\n📋 Seeding ${count} subscriptions...`);

  const subscriptions = [];
  for (let i = 0; i < count; i++) {
    // Use fake but consistent user IDs
    const userId = `seed_user_${i}`;
    subscriptions.push(generateSubscription(userId));

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`.`);
    }
  }

  try {
    const result = await OrganizerSubscription.insertMany(subscriptions);
    console.log(`\n✅ Created ${result.length} subscriptions`);

    // Print summary
    const planCounts = await OrganizerSubscription.aggregate([
      { $group: { _id: '$planType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n   Breakdown by plan:');
    for (const plan of planCounts) {
      console.log(`   - ${plan._id}: ${plan.count}`);
    }
  } catch (error: any) {
    console.error('❌ Error seeding subscriptions:', error.message);
  }
}

/**
 * Seed leads
 */
async function seedLeads(count: number) {
  console.log(`\n👥 Seeding ${count} leads...`);

  const leads = [];
  const trips = [
    { id: 'trip_1', name: 'Himalayas Trek' },
    { id: 'trip_2', name: 'Kerala Backwaters' },
    { id: 'trip_3', name: 'Rajasthan Desert' },
    { id: 'trip_4', name: 'Goa Beach' },
    { id: 'trip_5', name: 'Northeast Adventure' },
  ];

  for (let i = 0; i < count; i++) {
    const organizerId = `seed_user_${Math.floor(i / 5)}`;
    const trip = trips[i % trips.length];
    leads.push(generateLead(organizerId, trip.id, trip.name));

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`.`);
    }
  }

  try {
    const result = await Lead.insertMany(leads);
    console.log(`\n✅ Created ${result.length} leads`);

    // Print summary
    const statusCounts = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log('\n   Breakdown by status:');
    for (const status of statusCounts) {
      console.log(`   - ${status._id}: ${status.count}`);
    }

    // Calculate conversion rate
    const total = await Lead.countDocuments();
    const qualified = await Lead.countDocuments({ status: 'qualified' });
    const conversionRate = total > 0 ? ((qualified / total) * 100).toFixed(2) : '0.00';
    console.log(`\n   Conversion rate: ${conversionRate}%`);
  } catch (error: any) {
    console.error('❌ Error seeding leads:', error.message);
  }
}

/**
 * Seed payments
 */
async function seedPayments(count: number) {
  console.log(`\n💳 Seeding ${count} payments...`);

  const payments = [];
  for (let i = 0; i < count; i++) {
    const userId = `seed_user_${i}`;
    payments.push(generatePayment(userId));

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`.`);
    }
  }

  try {
    const result = await Payment.insertMany(payments);
    console.log(`\n✅ Created ${result.length} payments`);

    // Print summary
    const statusCounts = await Payment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    console.log('\n   Breakdown by status:');
    for (const status of statusCounts) {
      console.log(`   - ${status._id}: ${status.count}`);
    }

    // Calculate total revenue
    const revenuePipeline = [
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ];
    const revenue = await Payment.aggregate(revenuePipeline);
    const totalRevenue = revenue[0]?.total || 0;
    console.log(`\n   Total revenue from completed payments: ₹${totalRevenue.toLocaleString('en-IN')}`);
  } catch (error: any) {
    console.error('❌ Error seeding payments:', error.message);
  }
}

/**
 * Seed activities
 */
async function seedActivities(count: number) {
  console.log(`\n📊 Seeding ${count} activities...`);

  const activities = [];
  for (let i = 0; i < count; i++) {
    const userId = `seed_user_${Math.floor(i / 10)}`;
    activities.push(generateActivity(userId));

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`.`);
    }
  }

  try {
    const result = await UserActivity.insertMany(activities);
    console.log(`\n✅ Created ${result.length} activities`);

    // Print summary
    const activityCounts = await UserActivity.aggregate([
      { $group: { _id: '$activityType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('\n   Top activities:');
    activityCounts.slice(0, 5).forEach((activity: any) => {
      console.log(`   - ${activity._id}: ${activity.count}`);
    });
  } catch (error: any) {
    console.error('❌ Error seeding activities:', error.message);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  try {
    // Connect to MongoDB
    console.log(`\n🔌 Connecting to MongoDB...`);
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe');
    console.log('✅ Connected successfully');

    // Run seeding based on type
    const allTypes = seedType === 'all';

    if (allTypes || seedType === 'subscriptions') {
      await seedSubscriptions(seedCount);
    }

    if (allTypes || seedType === 'leads') {
      await seedLeads(seedCount);
    }

    if (allTypes || seedType === 'payments') {
      await seedPayments(seedCount);
    }

    if (allTypes || seedType === 'activities') {
      await seedActivities(seedCount * 2); // Seed more activities
    }

    // Print summary statistics
    console.log('\n\n📊 DATABASE SUMMARY');
    console.log('==========================================');

    const counts = {
      subscriptions: await OrganizerSubscription.countDocuments(),
      leads: await Lead.countDocuments(),
      payments: await Payment.countDocuments(),
      activities: await UserActivity.countDocuments(),
    };

    console.log(`Total Subscriptions: ${counts.subscriptions.toLocaleString()}`);
    console.log(`Total Leads: ${counts.leads.toLocaleString()}`);
    console.log(`Total Payments: ${counts.payments.toLocaleString()}`);
    console.log(`Total Activities: ${counts.activities.toLocaleString()}`);

    // Calculate some metrics
    const crmAccessCount = await OrganizerSubscription.countDocuments({ crmAccess: true });
    console.log(`\nOrganizers with CRM Access: ${crmAccessCount}`);

    const avgTripsPerPlan = await OrganizerSubscription.aggregate([
      { $group: { _id: '$planType', avgTrips: { $avg: '$trips' } } }
    ]);
    console.log('\nAverage trips per plan tier:');
    for (const plan of avgTripsPerPlan) {
      console.log(`- ${plan._id}: ${plan.avgTrips.toFixed(1)}`);
    }

    console.log('\n✅ Seeding completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB\n');
  }
}

// Run the script
main();
