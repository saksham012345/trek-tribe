/*
 * Marks demo/test users as verified to bypass email verification for local/test environments.
 * Requires MONGODB_URI in environment (same as the app uses).
 */

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Missing MONGODB_URI env variable. Aborting.');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    const db = mongoose.connection.db;

    const emails = [
      'admin@trektribe.com',
      'agent@trektribe.com',
      'organizer-premium@trektribe.com',
      'organizer-basic@trektribe.com',
      'traveler@trektribe.com'
    ];

    const result = await db.collection('users').updateMany(
      { email: { $in: emails } },
      { $set: { emailVerified: true, isVerified: true, emailVerifiedAt: new Date() } }
    );

    console.log(`Updated ${result.modifiedCount} user(s).`);
  } catch (err) {
    console.error('Error verifying users:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
