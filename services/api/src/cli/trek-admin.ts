#!/usr/bin/env node

// Node.js Concept: Command-line application with process.argv and commander
import { Command } from 'commander';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';
import { prisma } from '../lib/prisma';
import { fileHandler } from '../utils/fileHandler';
import { logger } from '../utils/logger';

// Node.js Concept: Process environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// Node.js Concept: Command-line color output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

function colorLog(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Node.js Concept: Database connection utility
async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    colorLog('green', '✅ Connected to MongoDB');
  } catch (error) {
    colorLog('red', `❌ Failed to connect to MongoDB: ${error}`);
    process.exit(1);
  }
}

async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    colorLog('green', '✅ Disconnected from MongoDB');
  } catch (error) {
    colorLog('red', `❌ Error disconnecting from MongoDB: ${error}`);
  }
}

// Node.js Concept: CLI command implementations

// User management commands
async function listUsers(options: any) {
  await connectDatabase();
  
  try {
    const query: any = {};
    if (options.role) query.role = options.role;
    if (options.email) query.email = new RegExp(options.email, 'i');
    
    const users = await User.find(query)
      .select('-passwordHash')
      .limit(options.limit || 10)
      .sort({ createdAt: -1 });

    console.log('\n📋 Users:');
    console.log('━'.repeat(80));
    
    users.forEach(user => {
      console.log(`🆔 ${user._id}`);
      console.log(`👤 Name: ${user.name}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`👔 Role: ${user.role}`);
      console.log(`📅 Created: ${user.createdAt.toISOString()}`);
      console.log('─'.repeat(40));
    });

    colorLog('cyan', `\n📊 Total users found: ${users.length}`);
  } catch (error) {
    colorLog('red', `❌ Error listing users: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

async function createUser(email: string, name: string, role: string, password: string) {
  await connectDatabase();
  
  try {
    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await User.create({
      email,
      name,
      role,
      passwordHash
    });

    colorLog('green', `✅ Created user: ${user.name} (${user.email})`);
    console.log(`🆔 User ID: ${user._id}`);
  } catch (error: any) {
    if (error.code === 11000) {
      colorLog('red', '❌ Email already exists');
    } else {
      colorLog('red', `❌ Error creating user: ${error.message}`);
    }
  } finally {
    await disconnectDatabase();
  }
}

async function deleteUser(email: string, options: any) {
  await connectDatabase();
  
  try {
    if (!options.force) {
      colorLog('yellow', '⚠️  This will permanently delete the user and all associated data');
      colorLog('yellow', '⚠️  Use --force flag to confirm deletion');
      return;
    }

    const user = await User.findOneAndDelete({ email });
    if (!user) {
      colorLog('red', '❌ User not found');
      return;
    }

    // Clean up related data
    await Review.deleteMany({ reviewerId: user._id });
    await prisma.wishlist.deleteMany({ where: { userId: String(user._id) } });
    await Trip.updateMany(
      { participants: user._id },
      { $pull: { participants: user._id } }
    );

    colorLog('green', `✅ Deleted user: ${user.name} (${user.email})`);
  } catch (error) {
    colorLog('red', `❌ Error deleting user: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// Trip management commands
async function listTrips(options: any) {
  await connectDatabase();
  
  try {
    const query: any = {};
    if (options.status) query.status = options.status;
    if (options.destination) query.destination = new RegExp(options.destination, 'i');
    
    const trips = await Trip.find(query)
      .populate('organizerId', 'name email')
      .limit(options.limit || 10)
      .sort({ createdAt: -1 });

    console.log('\n🗺️  Trips:');
    console.log('━'.repeat(80));
    
    trips.forEach(trip => {
      console.log(`🆔 ${trip._id}`);
      console.log(`📍 ${trip.title} - ${trip.destination}`);
      console.log(`👤 Organizer: ${(trip.organizerId as any)?.name}`);
      console.log(`💰 Price: $${trip.price}`);
      console.log(`👥 Participants: ${trip.participants.length}/${trip.capacity}`);
      console.log(`📅 ${trip.startDate.toISOString().split('T')[0]} - ${trip.endDate.toISOString().split('T')[0]}`);
      console.log(`🚦 Status: ${trip.status}`);
      console.log('─'.repeat(40));
    });

    colorLog('cyan', `\n📊 Total trips found: ${trips.length}`);
  } catch (error) {
    colorLog('red', `❌ Error listing trips: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// Database statistics command
async function showStats() {
  await connectDatabase();
  
  try {
    // Node.js Concept: Promise.all for parallel database queries
    const [
      totalUsers,
      totalTrips,
      totalReviews,
      totalWishlistItems,
      usersByRole,
      tripsByStatus,
      avgRating,
      storageStats
    ] = await Promise.all([
      User.countDocuments(),
      Trip.countDocuments(),
      Review.countDocuments(),
      prisma.wishlist.count(),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      Trip.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Review.aggregate([
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ]),
      fileHandler.getStorageStats()
    ]);

    console.log('\n📊 Trek Tribe Statistics');
    console.log('━'.repeat(50));
    
    colorLog('cyan', `👥 Total Users: ${totalUsers}`);
    usersByRole.forEach(role => {
      console.log(`   ${role._id}: ${role.count}`);
    });
    
    colorLog('cyan', `\n🗺️  Total Trips: ${totalTrips}`);
    tripsByStatus.forEach(status => {
      console.log(`   ${status._id}: ${status.count}`);
    });
    
    colorLog('cyan', `\n⭐ Total Reviews: ${totalReviews}`);
    if (avgRating.length > 0) {
      console.log(`   Average Rating: ${avgRating[0].avgRating.toFixed(1)}/5`);
    }
    
    colorLog('cyan', `\n❤️  Wishlist Items: ${totalWishlistItems}`);
    
    colorLog('cyan', `\n📁 File Storage:`);
    console.log(`   Total Files: ${storageStats.totalFiles}`);
    console.log(`   Total Size: ${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    console.log('\n📈 Database Health:');
    if (mongoose.connection.db) {
      const dbStats = await mongoose.connection.db.stats();
      console.log(`   Collections: ${dbStats.collections}`);
      console.log(`   Data Size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Index Size: ${(dbStats.indexSize / 1024 / 1024).toFixed(2)} MB`);
    } else {
      console.log('   Database connection not available');
    }
    
  } catch (error) {
    colorLog('red', `❌ Error getting stats: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// Data backup command
// Node.js Concept: File system operations for data export
async function backupData(outputPath: string) {
  await connectDatabase();
  
  try {
    colorLog('yellow', '📦 Starting data backup...');
    
    const [users, trips, reviews, wishlists] = await Promise.all([
      User.find().select('-passwordHash').lean(),
      Trip.find().lean(),
      Review.find().lean(),
      prisma.wishlist.findMany()
    ]);

    const backup = {
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        totalRecords: users.length + trips.length + reviews.length + wishlists.length
      },
      collections: {
        users,
        trips,
        reviews,
        wishlists
      }
    };

    const backupPath = outputPath || `backup_${Date.now()}.json`;
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    colorLog('green', `✅ Backup completed: ${backupPath}`);
    colorLog('cyan', `📊 Exported ${backup.metadata.totalRecords} records`);
    
    // Create backup summary
    console.log('\n📋 Backup Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Trips: ${trips.length}`);
    console.log(`   Reviews: ${reviews.length}`);
    console.log(`   Wishlist Items: ${wishlists.length}`);
    
  } catch (error) {
    colorLog('red', `❌ Error creating backup: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// Data restoration command
async function restoreData(inputPath: string, options: any) {
  await connectDatabase();
  
  try {
    if (!options.force) {
      colorLog('yellow', '⚠️  This will overwrite existing data');
      colorLog('yellow', '⚠️  Use --force flag to confirm restoration');
      return;
    }

    colorLog('yellow', '📦 Starting data restoration...');
    
    const backupData = JSON.parse(await fs.readFile(inputPath, 'utf-8'));
    const { collections } = backupData;
    
    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Trip.deleteMany({}),
      Review.deleteMany({}),
      prisma.wishlist.deleteMany({})
    ]);
    
    // Restore data
    const results = await Promise.all([
      User.insertMany(collections.users),
      Trip.insertMany(collections.trips),
      Review.insertMany(collections.reviews),
      prisma.wishlist.createMany({ data: collections.wishlists, skipDuplicates: true })
    ]);
    
    colorLog('green', `✅ Data restored successfully`);
    
    console.log('\n📋 Restoration Summary:');
    console.log(`   Users: ${results[0].length}`);
    console.log(`   Trips: ${results[1].length}`);
    console.log(`   Reviews: ${results[2].length}`);
    console.log(`   Wishlist Items: ${results[3].count}`);
    
  } catch (error) {
    colorLog('red', `❌ Error restoring data: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// System maintenance commands
async function cleanupSystem() {
  await connectDatabase();
  
  try {
    colorLog('yellow', '🧹 Starting system cleanup...');
    
    // Cleanup orphaned reviews
    const orphanedReviews = await Review.find({
      $or: [
        { reviewerId: { $exists: false } },
        { targetId: { $exists: false } }
      ]
    });
    
    if (orphanedReviews.length > 0) {
      await Review.deleteMany({
        _id: { $in: orphanedReviews.map(r => r._id) }
      });
      colorLog('green', `🗑️  Removed ${orphanedReviews.length} orphaned reviews`);
    }
    
    // Wishlists moved to Postgres (D10/D11 wave 2), where user_id and trip_id
    // are NOT NULL, so a row missing either one cannot exist to be cleaned up.
    colorLog('cyan', '   Wishlist items: nothing to clean (columns are NOT NULL)');
    
    // Cleanup expired trips
    const expiredTrips = await Trip.find({
      endDate: { $lt: new Date() },
      status: 'active'
    });
    
    if (expiredTrips.length > 0) {
      await Trip.updateMany(
        { _id: { $in: expiredTrips.map(t => t._id) } },
        { status: 'completed' }
      );
      colorLog('green', `📅 Updated ${expiredTrips.length} expired trips to completed`);
    }
    
    // Cleanup temporary files
    const cleanedFiles = await fileHandler.cleanupTempFiles();
    if (cleanedFiles > 0) {
      colorLog('green', `🗑️  Cleaned up ${cleanedFiles} temporary files`);
    }
    
    colorLog('green', '✅ System cleanup completed');
    
  } catch (error) {
    colorLog('red', `❌ Error during cleanup: ${error}`);
  } finally {
    await disconnectDatabase();
  }
}

// Log analysis command
async function analyzeLogs(options: any) {
  try {
    colorLog('yellow', '📊 Analyzing application logs...');
    
    const logFiles = await logger.getLogFiles();
    const stats = await logger.getLogStats();
    
    console.log('\n📋 Log Analysis:');
    console.log('━'.repeat(50));
    console.log(`📁 Total log files: ${stats.totalFiles}`);
    console.log(`📦 Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 Oldest log: ${stats.oldestLog}`);
    console.log(`📅 Newest log: ${stats.newestLog}`);
    
    if (options.errors && stats.newestLog) {
      const errorFile = stats.newestLog.replace('.log', '-errors.log');
      try {
        const errorLogs = await logger.readLogFile(errorFile);
        console.log(`\n🚨 Recent errors (${errorLogs.length}):`);
        
        errorLogs.slice(-5).forEach(log => {
          console.log(`   ${log.timestamp}: ${log.message}`);
        });
      } catch (error) {
        colorLog('yellow', '⚠️  No error log file found');
      }
    }
    
  } catch (error) {
    colorLog('red', `❌ Error analyzing logs: ${error}`);
  }
}

// Node.js Concept: Commander.js CLI setup
const program = new Command();

program
  .name('trek-admin')
  .description('Trek Tribe administration CLI tool')
  .version('1.0.0');

// User management commands
const userCmd = program.command('user').description('User management commands');

userCmd
  .command('list')
  .description('List users')
  .option('-r, --role <role>', 'Filter by role')
  .option('-e, --email <email>', 'Filter by email pattern')
  .option('-l, --limit <limit>', 'Limit results', '10')
  .action(listUsers);

userCmd
  .command('create <email> <name> <role> <password>')
  .description('Create a new user')
  .action(createUser);

userCmd
  .command('delete <email>')
  .description('Delete a user')
  .option('-f, --force', 'Force deletion without confirmation')
  .action(deleteUser);

// Trip management commands
const tripCmd = program.command('trip').description('Trip management commands');

tripCmd
  .command('list')
  .description('List trips')
  .option('-s, --status <status>', 'Filter by status')
  .option('-d, --destination <destination>', 'Filter by destination')
  .option('-l, --limit <limit>', 'Limit results', '10')
  .action(listTrips);

// System commands
program
  .command('stats')
  .description('Show system statistics')
  .action(showStats);

program
  .command('backup [output]')
  .description('Backup all data to JSON file')
  .action(backupData);

program
  .command('restore <input>')
  .description('Restore data from JSON file')
  .option('-f, --force', 'Force restoration without confirmation')
  .action(restoreData);

program
  .command('cleanup')
  .description('Perform system cleanup')
  .action(cleanupSystem);

program
  .command('logs')
  .description('Analyze application logs')
  .option('-e, --errors', 'Show recent errors')
  .action(analyzeLogs);

// Node.js Concept: Process error handling and graceful exit
process.on('SIGINT', async () => {
  colorLog('yellow', '\n⚠️  Received SIGINT, shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  colorLog('red', `❌ Unhandled Rejection at: ${promise} reason: ${reason}`);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  colorLog('red', `❌ Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Node.js Concept: Parse command line arguments
if (require.main === module) {
  program.parse(process.argv);
  
  // Show help if no command provided
  if (!process.argv.slice(2).length) {
    program.outputHelp();
  }
}

export { program };
