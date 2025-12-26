const mongoose = require('mongoose');

// NOTE: Use environment variable to avoid committing credentials.
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('Missing MONGODB_URI env variable. Aborting to avoid using hardcoded credentials.');
  process.exit(1);
}

mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('Connected to MongoDB\n');
    return mongoose.connection.db.collection('users').find({}, { projection: { email: 1, name: 1, role: 1 } }).toArray();
  })
  .then(users => {
    console.log('Users in database:');
    console.log('==================\n');
    users.forEach((u, i) => {
      console.log(`${i+1}. Email: ${u.email}`);
      console.log(`   Name: ${u.name}`);
      console.log(`   Role: ${u.role}\n`);
    });
    process.exit(0);
  })
  .catch(e => {
    console.log('Error:', e.message);
    process.exit(1);
  });
