const mongoose = require('mongoose');

// Simple Trip Schema for migration
const tripSchema = new mongoose.Schema({
    title: String,
    slug: String
}, { strict: false });

const Trip = mongoose.model('Trip', tripSchema);

const slugify = (text) => {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
};

async function migrate() {
    try {
        const mongoUri = 'mongodb+srv://tanejasaksham384_db_user:Saksham4700@trekk.wphfse5.mongodb.net/?appName=Trekk';

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected');

        const trips = await Trip.find({ slug: { $exists: false } });
        console.log(`Found ${trips.length} trips without slugs.`);

        for (const trip of trips) {
            if (trip.title) {
                let slug = slugify(trip.title);
                // Basic collision handling
                const exists = await Trip.findOne({ slug });
                if (exists) {
                    slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
                }

                trip.slug = slug;
                await trip.save();
                console.log(`✅ Generated slug for "${trip.title}": ${slug}`);
            }
        }

        console.log('🎉 Migration complete');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

migrate();
