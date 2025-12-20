const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://tanejasaksham384_db_user:Saksham4700@trekk.wphfse5.mongodb.net/?appName=Trekk';

async function main() {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✓ Connected to MongoDB\n');

    const db = mongoose.connection.db;

    // Step 1: Fetch tickets
    console.log('=== STEP 1: FETCHING EXISTING TICKETS ===\n');
    const ticketsCollection = db.collection('supporttickets');
    const tickets = await ticketsCollection.find({}).toArray();
    console.log(`Tickets found: ${tickets.length}`);
    if (tickets.length > 0) {
      tickets.forEach((t, i) => {
        console.log(`\n${i+1}. Title: ${t.title}`);
        console.log(`   Description: ${t.description}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Priority: ${t.priority}`);
        console.log(`   Created: ${t.createdAt}`);
      });
    }

    // Step 2: Fetch trips
    console.log('\n\n=== STEP 2: FETCHING EXISTING TRIPS ===\n');
    const tripsCollection = db.collection('trips');
    const trips = await tripsCollection.find({}).toArray();
    console.log(`Trips found: ${trips.length}`);
    if (trips.length > 0) {
      trips.forEach((t, i) => {
        console.log(`\n${i+1}. Name: ${t.name}`);
        console.log(`   Destination: ${t.destination}`);
        console.log(`   Duration: ${t.duration}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Created: ${t.createdAt}`);
      });
    }

    // Step 3: Clean database
    console.log('\n\n=== STEP 3: CLEANING DATABASE ===\n');
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    for (const name of collectionNames) {
      if (name !== 'system.indexes') {
        await db.collection(name).deleteMany({});
        console.log(`✓ Cleared collection: ${name}`);
      }
    }

    // Step 4: Verify clean
    console.log('\n\n=== STEP 4: VERIFYING DATABASE IS CLEAN ===\n');
    const users = await db.collection('users').countDocuments();
    const tripsCount = await db.collection('trips').countDocuments();
    const ticketsCount = await db.collection('supporttickets').countDocuments();
    const subsCount = await db.collection('subscriptions').countDocuments();
    
    console.log(`Users: ${users}`);
    console.log(`Trips: ${tripsCount}`);
    console.log(`Tickets: ${ticketsCount}`);
    console.log(`Subscriptions: ${subsCount}`);
    console.log(`✓ Database is clean!`);

    // Step 5: Create new users with premium organizer
    console.log('\n\n=== STEP 5: CREATING NEW USERS ===\n');
    const usersCollection = db.collection('users');
    
    const demoUsers = [
      { email: 'admin@trektribe.com', name: 'Admin User', role: 'admin', password: 'Admin@123456' },
      { email: 'agent@trektribe.com', name: 'Agent User', role: 'agent', password: 'Agent@123456' },
      { email: 'organizer-premium@trektribe.com', name: 'Premium Organizer', role: 'organizer', password: 'Organizer@123456', isPremium: true },
      { email: 'organizer-basic@trektribe.com', name: 'Basic Organizer', role: 'organizer', password: 'Organizer@123456', isPremium: false },
      { email: 'traveler@trektribe.com', name: 'Traveler User', role: 'traveler', password: 'Traveler@123456' }
    ];

    const createdUsers = [];
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 12);
      const doc = {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        isVerified: true,
        isPremium: user.isPremium || false,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await usersCollection.insertOne(doc);
      createdUsers.push({ ...doc, _id: result.insertedId });
      console.log(`✓ Created: ${user.email} (${user.role})`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Premium: ${user.isPremium || false}\n`);
    }

    // Step 6: Create sample trips
    console.log('\n\n=== STEP 6: CREATING SAMPLE TRIPS ===\n');
    const tripsCol = db.collection('trips');
    const premiumOrganizer = createdUsers.find(u => u.isPremium && u.role === 'organizer');
    const basicOrganizer = createdUsers.find(u => !u.isPremium && u.role === 'organizer');

    const sampleTrips = [
      {
        name: 'Himalayan Adventure',
        destination: 'Himachal Pradesh',
        description: 'Exciting trek through Himalayan peaks',
        duration: 7,
        startDate: new Date('2025-02-01'),
        endDate: new Date('2025-02-08'),
        price: 15000,
        maxParticipants: 20,
        status: 'published',
        organizerId: premiumOrganizer._id,
        organizerName: premiumOrganizer.name,
        difficulty: 'hard',
        highlights: ['Peak climbing', 'Mountain views', 'Local culture'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Goa Beach Getaway',
        destination: 'Goa',
        description: 'Relaxing beach trip with water sports',
        duration: 5,
        startDate: new Date('2025-03-15'),
        endDate: new Date('2025-03-20'),
        price: 8000,
        maxParticipants: 30,
        status: 'published',
        organizerId: basicOrganizer._id,
        organizerName: basicOrganizer.name,
        difficulty: 'easy',
        highlights: ['Beach', 'Water sports', 'Nightlife'],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Kashmir Valley Trek',
        destination: 'Kashmir',
        description: 'Beautiful valley trek with stunning landscapes',
        duration: 6,
        startDate: new Date('2025-04-10'),
        endDate: new Date('2025-04-16'),
        price: 12000,
        maxParticipants: 25,
        status: 'draft',
        organizerId: premiumOrganizer._id,
        organizerName: premiumOrganizer.name,
        difficulty: 'medium',
        highlights: ['Valley views', 'Lakes', 'Photography'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const trip of sampleTrips) {
      await tripsCol.insertOne(trip);
      console.log(`✓ Created trip: ${trip.name}`);
      console.log(`  Organizer: ${trip.organizerName} (${trip.organizerId})`);
      console.log(`  Duration: ${trip.duration} days`);
      console.log(`  Price: ₹${trip.price}`);
      console.log(`  Status: ${trip.status}\n`);
    }

    // Step 7: Verify final state
    console.log('\n\n=== STEP 7: FINAL VERIFICATION ===\n');
    const finalUsers = await db.collection('users').countDocuments();
    const finalTrips = await db.collection('trips').countDocuments();
    console.log(`Final Users: ${finalUsers}`);
    console.log(`Final Trips: ${finalTrips}`);
    console.log(`✓ Setup complete!\n`);

    // Answer about env variables
    console.log('=== ENVIRONMENT VARIABLES & CREDENTIALS ===\n');
    console.log('Q: Do env variables override preset user credentials?');
    console.log('A: NO. Environment variables are for application config (database, API keys, etc.)');
    console.log('   User credentials are stored in the database and protected by password hashing.');
    console.log('   Env variables cannot override user login credentials.\n');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
