import 'dotenv/config';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { logger } from '../utils/logger';

// Helper to slugify text
const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')     // Replace spaces and underscores with -
        .replace(/[^\w-]/g, '')      // Remove all non-word chars
        .replace(/--+/g, '-')        // Replace multiple - with single -
        .replace(/^-+/, '')          // Trim - from start of text
        .replace(/-+$/, '');         // Trim - from end of text
};

const runMigration = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) {
            throw new Error('MONGODB_URI is required');
        }

        console.log('🔄 Connecting to database...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected.');

        console.log('🔍 Finding trips without slugs...');
        // Find trips where slug is missing or empty
        const trips = await Trip.find({
            $or: [
                { slug: { $exists: false } },
                { slug: null },
                { slug: '' }
            ]
        });

        console.log(`📌 Found ${trips.length} trips to update.`);

        let updatedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (const trip of trips) {
            try {
                if (!trip.title) {
                    console.warn(`⚠️ Trip ${trip._id} has no title, skipping.`);
                    skippedCount++;
                    continue;
                }

                let baseSlug = slugify(trip.title);

                // Handle empty slug after sanitization
                if (!baseSlug) {
                    baseSlug = `trip-${trip._id}`;
                }

                let dbSlug = baseSlug;
                let counter = 1;

                // Check for uniqueness
                while (true) {
                    const existing = await Trip.findOne({ slug: dbSlug, _id: { $ne: trip._id } });
                    if (!existing) break;
                    dbSlug = `${baseSlug}-${counter}`;
                    counter++;
                }

                trip.slug = dbSlug;
                await trip.save();
                console.log(`✅ Updated: "${trip.title}" -> "${dbSlug}"`);
                updatedCount++;

            } catch (err: any) {
                console.error(`❌ Failed to update trip ${trip._id}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n📊 Migration Summary:');
        console.log(`✅ Updated: ${updatedCount}`);
        console.log(`⏭️ Skipped: ${skippedCount}`);
        console.log(`❌ Errors:  ${errorCount}`);

        process.exit(0);
    } catch (error: any) {
        console.error('🔥 Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
