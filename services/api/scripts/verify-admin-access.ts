
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../src/models/User';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verifyAdmin() {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://tanejasaksham384_db_user:Saksham4700@trekk.wphfse5.mongodb.net/?appName=Trekk";

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    try {
        const adminEmail = 'trektribe_root@trektribe.in';
        const user = await User.findOne({ email: adminEmail });

        if (!user) {
            console.error('❌ Admin user not found!');
        } else {
            console.log('✅ Admin user found:');
            console.log(`   ID: ${user._id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: '${user.role}'`); // Quote to see unseen chars
            console.log(`   Email Verified: ${user.emailVerified}`);

            if (user.role !== 'admin') {
                console.error('❌ ROLE MISMATCH: Expected "admin"');
            } else {
                console.log('✅ Role matches "admin"');
            }
        }
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyAdmin();
