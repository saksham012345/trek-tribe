require('dotenv').config();
const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema({
    title: String,
    slug: String
}, { strict: false }); // strict: false allows us to not define the whole schema

const Trip = mongoose.model('Trip', tripSchema);

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/[^\w-]/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
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
        const trips = await Trip.find({
            $or: [
                { slug: { $exists: false } },
                { slug: null },
                { slug: '' }
            ]
        });

        console.log(`📌 Found ${trips.length} trips to update.`);

        let updatedCount = 0;

        for (const trip of trips) {
            if (!trip.title) continue;

            let baseSlug = slugify(trip.title);
            if (!baseSlug) baseSlug = `trip-${trip._id}`;

            let dbSlug = baseSlug;
            let counter = 1;

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
        }

        console.log(`\n🎉 Done! Updated ${updatedCount} trips.`);
        process.exit(0);
    } catch (error) {
        console.error('🔥 Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
