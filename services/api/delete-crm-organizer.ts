import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function deleteCRMOrganizer() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    console.log('\n🗑️  DELETING CRM ORGANIZER ACCOUNT\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);
    const OrganizerProfile = mongoose.model('OrganizerProfile', userSchema);
    const CRMSubscription = mongoose.model('CRMSubscription', userSchema);

    const email = 'crm.manager@trektribe.in';

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ CRM organizer not found');
      await mongoose.connection.close();
      return;
    }

    console.log('Found user:', user._id);

    // Delete profile
    const profileDeleted = await OrganizerProfile.deleteOne({ userId: user._id });
    console.log(`✅ Deleted organizer profile: ${profileDeleted.deletedCount}`);

    // Delete subscription
    const subDeleted = await CRMSubscription.deleteOne({ organizerId: user._id });
    console.log(`✅ Deleted CRM subscription: ${subDeleted.deletedCount}`);

    // Delete user
    const userDeleted = await User.deleteOne({ email });
    console.log(`✅ Deleted user: ${userDeleted.deletedCount}`);

    console.log('\n✅ CRM organizer deleted successfully\n');

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

deleteCRMOrganizer();
