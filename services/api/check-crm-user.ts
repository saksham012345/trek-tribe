import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function checkCRMUser() {
  try {
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not set');
    }

    console.log('\n🔍 CHECKING CRM USER\n');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const userSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.model('User', userSchema);

    const email = 'crm.manager@trektribe.in';
    const user: any = await User.findOne({ email });

    if (!user) {
      console.log('❌ CRM user not found');
      await mongoose.connection.close();
      return;
    }

    console.log('📧 Email:', user.email);
    console.log('🔒 Has passwordHash:', !!user.passwordHash);
    console.log('✉️  emailVerified:', user.emailVerified);
    console.log('👤 Role:', user.role);
    console.log('📱 Phone:', user.phone);
    console.log('🆔 User ID:', user._id);
    console.log('\n📋 Full user object:');
    console.log(JSON.stringify(user.toObject(), null, 2));

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

checkCRMUser();
