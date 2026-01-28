import mongoose from 'mongoose';
import { User } from './src/models/User';
import CRMSubscription from './src/models/CRMSubscription';

/**
 * Grant CRM Access Script
 * Grants CRM bundle access to all existing organizer accounts
 */

async function grantCRMAccessToAllOrganizers() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Find all organizers
        const organizers = await User.find({ role: 'organizer' });
        console.log(`📊 Found ${organizers.length} organizer accounts`);

        let updatedCount = 0;
        let createdCount = 0;

        for (const organizer of organizers) {
            // Check if subscription exists
            let subscription = await CRMSubscription.findOne({
                organizerId: organizer._id,
            });

            if (subscription) {
                // Update existing subscription
                if (!subscription.crmBundle) {
                    subscription.crmBundle = {
                        hasAccess: true,
                        price: 0, // Free grant
                        features: [
                            'Lead Management',
                            'Support Ticketing',
                            'Chat Support',
                            'Analytics Dashboard',
                            'Trip Verification',
                            'Customer Insights',
                        ],
                    };
                } else {
                    subscription.crmBundle.hasAccess = true;
                }

                // Ensure status is active
                if (subscription.status !== 'active') {
                    subscription.status = 'active';
                }

                await subscription.save();
                updatedCount++;
                console.log(`✅ Updated CRM access for organizer: ${organizer.email}`);
            } else {
                // Create new subscription with CRM access
                subscription = new CRMSubscription({
                    organizerId: organizer._id,
                    planType: 'crm_bundle',
                    status: 'active',
                    crmBundle: {
                        hasAccess: true,
                        price: 0, // Free grant
                        features: [
                            'Lead Management',
                            'Support Ticketing',
                            'Chat Support',
                            'Analytics Dashboard',
                            'Trip Verification',
                            'Customer Insights',
                        ],
                    },
                    notifications: {
                        trialEndingIn7Days: false,
                        trialEndingIn1Day: false,
                        trialExpired: false,
                        paymentReminder: false,
                    },
                });

                await subscription.save();
                createdCount++;
                console.log(`✅ Created CRM subscription for organizer: ${organizer.email}`);
            }
        }

        console.log('\n📊 Summary:');
        console.log(`   Total organizers: ${organizers.length}`);
        console.log(`   Subscriptions updated: ${updatedCount}`);
        console.log(`   Subscriptions created: ${createdCount}`);
        console.log('\n✅ CRM access granted to all organizers successfully!');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error granting CRM access:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
grantCRMAccessToAllOrganizers();
