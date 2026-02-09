import 'dotenv/config';
import mongoose from 'mongoose';
import { OrganizerSubscription } from '../models/OrganizerSubscription';

/**
 * Drop duplicate indexes from OrganizerSubscription collection
 * Run this script to fix E11000 duplicate key errors in tests
 */
async function dropDuplicateIndexes() {
    try {
        console.log('🔧 Connecting to test database...');

        // Connect to test database
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/test';
        await mongoose.connect(mongoUri);

        console.log('✅ Connected to database');

        // Get the collection
        const collection = mongoose.connection.collection('organizersubscriptions');

        // List all indexes
        const indexes = await collection.indexes();
        console.log('📋 Current indexes:', JSON.stringify(indexes, null, 2));

        // Drop the duplicate organizerId_1 index if it exists
        try {
            await collection.dropIndex('organizerId_1');
            console.log('✅ Dropped organizerId_1 index');
        } catch (error: any) {
            if (error.code === 27) {
                console.log('ℹ️  Index organizerId_1 does not exist, skipping');
            } else {
                throw error;
            }
        }

        // List indexes after cleanup
        const indexesAfter = await collection.indexes();
        console.log('📋 Indexes after cleanup:', JSON.stringify(indexesAfter, null, 2));

        console.log('✅ Index cleanup complete');

    } catch (error: any) {
        console.error('❌ Error during index cleanup:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from database');
    }
}

// Run if called directly
if (require.main === module) {
    dropDuplicateIndexes()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

export { dropDuplicateIndexes };
