import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Trip } from '../models/Trip';

const setupDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully');

    // Create indexes for better performance
    console.log('🔧 Creating database indexes...');
    
    // User indexes
    await User.createIndexes();
    console.log('✅ User indexes created');

    // Trip indexes  
    await Trip.createIndexes();
    console.log('✅ Trip indexes created');

    // Test connection with a simple query
    console.log('🧪 Testing database operations...');
    const userCount = await User.countDocuments();
    const tripCount = await Trip.countDocuments();
    
    console.log(`📊 Database stats:`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Trips: ${tripCount}`);
    
    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run if called directly
if (require.main === module) {
  setupDatabase();
}

export { setupDatabase };