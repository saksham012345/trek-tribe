
import mongoose from 'mongoose';
import { User } from '../models/User';

async function checkUserRole() {
    try {
        const mongoUri = 'mongodb+srv://tanejasaksham384_db_user:Saksham4700@trekk.wphfse5.mongodb.net/?appName=Trekk';

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const email = 'trektribeagent@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User not found: ${email}`);
        } else {
            console.log(`👤 User found: ${user.name}`);
            console.log(`🔑 Current Role: ${user.role}`);

            if (user.role !== 'agent') {
                console.log('⚠️ Role mismatch. Updating to "agent"...');
                user.role = 'agent';
                await user.save();
                console.log('✅ Role updated to "agent"');
            } else {
                console.log('✅ User already has "agent" role');
            }
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected');
        process.exit(0);
    }
}

checkUserRole();
