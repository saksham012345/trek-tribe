
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Define simple schemas/models to avoid importing full app context
const userSchema = new mongoose.Schema({
    role: String,
    email: String,
    name: String
});
const User = mongoose.model('User', userSchema);

const subscriptionSchema = new mongoose.Schema({
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    plan: String,
    status: String,
    tripsRemaining: Number,
    tripsPerCycle: Number,
    subscriptionEndDate: Date,
    isTrialActive: Boolean,
    crmAccess: Boolean,
    isValid: Boolean
}, { timestamps: true });

const OrganizerSubscription = mongoose.model('OrganizerSubscription', subscriptionSchema);

async function main() {
    const mongoUri = process.env.MONGODB_URI || "mongodb+srv://tanejasaksham384_db_user:Saksham4700@trekk.wphfse5.mongodb.net/?appName=Trekk";

    if (!mongoUri) {
        console.error('❌ MONGODB_URI not found in environment');
        process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected');

    try {
        // 1. Find all organizers
        const organizers = await User.find({ role: 'organizer' });
        console.log(`Found ${organizers.length} organizers.`);

        for (const org of organizers) {
            console.log(`Processing organizer: ${org.name} (${org.email})...`);

            // 2. Grant subscription
            await OrganizerSubscription.findOneAndUpdate(
                { organizerId: org._id },
                {
                    $set: {
                        plan: 'premium',
                        status: 'active',
                        tripsRemaining: 9999, // Unlimited
                        tripsPerCycle: 9999,
                        subscriptionEndDate: new Date('2030-01-01'), // Long expiry
                        isTrialActive: false,
                        crmAccess: true, // Give CRM access too
                        notificationsSent: []
                    }
                },
                { upsert: true, new: true }
            );

            console.log(`✅ Granted full access to ${org.email}`);
        }

        console.log('🎉 All organizers updated successfully!');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main();
