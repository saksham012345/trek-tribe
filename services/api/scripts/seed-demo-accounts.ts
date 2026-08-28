/**
 * Create the five demo accounts documented in README_DEMO_SETUP.md.
 *
 *   npx ts-node scripts/seed-demo-accounts.ts
 *
 * Users only - no sample trips or tickets.
 *
 * ─── Why this exists alongside setup-demo-database.ts ────────────────────────
 *
 * setup-demo-database.ts imports Trip, OrganizerSubscription and Subscription
 * from src/models. All three were deleted in waves 7 and 8 when those models
 * moved to Postgres, so that script no longer compiles and the credentials its
 * README documents describe accounts nobody can create.
 *
 * This one is split the way the data now is: users go to Mongo through the
 * Mongoose model, which is still the store for User until wave 9 ports its
 * consumers; the premium organizer's subscription goes to Postgres through
 * Prisma, because that is where subscriptions live now.
 *
 * The basic organizer deliberately gets NO subscription row. That is the point
 * of it - it is the account that should hit the paywall.
 *
 * Safe to re-run: every account is matched on email and updated in place.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User';
import { prisma } from '../src/lib/prisma';

type Demo = {
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'agent' | 'organizer' | 'traveler';
  note: string;
};

const ACCOUNTS: Demo[] = [
  { email: 'admin@trektribe.com', password: 'Admin@123456', name: 'Demo Admin', role: 'admin', note: 'full platform administration' },
  { email: 'agent@trektribe.com', password: 'Agent@123456', name: 'Demo Agent', role: 'agent', note: 'support tickets and chat' },
  { email: 'organizer.premium@trektribe.com', password: 'Organizer@123', name: 'Premium Organizer', role: 'organizer', note: 'active premium subscription, CRM access' },
  { email: 'organizer.basic@trektribe.com', password: 'Organizer@123', name: 'Basic Organizer', role: 'organizer', note: 'NO subscription - should hit the paywall' },
  { email: 'traveler@trektribe.com', password: 'Traveler@123', name: 'Demo Traveler', role: 'traveler', note: 'browse, book, review' }
];

const PREMIUM_EMAIL = 'organizer.premium@trektribe.com';

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trekk-tribe';

  // Refuse to touch a hosted database. These are published passwords in a
  // README; creating them anywhere real would be handing out admin access.
  if (/mongodb\+srv:/i.test(uri) || /\.mongodb\.net/i.test(uri)) {
    throw new Error(
      'MONGODB_URI points at a hosted cluster. These are demo credentials from a ' +
      'checked-in README and must only ever be created against a local database.'
    );
  }

  console.log(`mongo: ${uri}`);
  await mongoose.connect(uri);

  const created: Array<{ email: string; id: string; role: string; note: string }> = [];

  for (const account of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    const existing = await User.findOne({ email: account.email });

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.name = account.name;
      existing.role = account.role;
      existing.isVerified = true;
      existing.emailVerified = true;
      await existing.save();
      created.push({ email: account.email, id: String(existing._id), role: account.role, note: account.note });
      console.log(`  updated  ${account.email}`);
    } else {
      const user = await User.create({
        email: account.email,
        passwordHash,
        name: account.name,
        role: account.role,
        isVerified: true,
        emailVerified: true
      });
      created.push({ email: account.email, id: String(user._id), role: account.role, note: account.note });
      console.log(`  created  ${account.email}`);
    }
  }

  // The premium organizer needs a subscription, and subscriptions are Postgres
  // now. Without this the account logs in but cannot create a trip.
  const premium = created.find(c => c.email === PREMIUM_EMAIL)!;
  const now = new Date();
  const inAYear = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  await prisma.organizerSubscription.upsert({
    where: { organizerId: premium.id },
    create: {
      organizerId: premium.id,
      plan: 'premium',
      planType: 'PROFESSIONAL',
      status: 'active',
      crmAccess: true,
      crmBundleHasAccess: true,
      subscriptionStartDate: now,
      subscriptionEndDate: inAYear,
      currentPeriodStart: now,
      currentPeriodEnd: inAYear,
      tripsPerCycle: 15,
      tripsUsed: 0,
      lastPaymentDate: now,
      nextPaymentDue: inAYear,
      notes: 'seeded by scripts/seed-demo-accounts.ts'
    },
    update: {
      plan: 'premium',
      status: 'active',
      crmAccess: true,
      crmBundleHasAccess: true,
      subscriptionEndDate: inAYear,
      currentPeriodEnd: inAYear,
      tripsPerCycle: 15,
      nextPaymentDue: inAYear
    }
  });
  console.log(`  subscription (Postgres) attached to ${PREMIUM_EMAIL}`);

  console.log('\n─── demo accounts ───────────────────────────────────────────');
  for (const account of ACCOUNTS) {
    const row = created.find(c => c.email === account.email)!;
    console.log(`\n  ${account.role.toUpperCase()}  ${account.note}`);
    console.log(`    email:    ${account.email}`);
    console.log(`    password: ${account.password}`);
    console.log(`    id:       ${row.id}`);
  }
  console.log('\nLocal database only. Do not create these anywhere reachable.\n');

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async err => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
