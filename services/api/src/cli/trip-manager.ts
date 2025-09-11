#!/usr/bin/env node

/**
 * Command-line interface for managing trips
 * Demonstrates Node.js CLI development, async programming, and error handling
 */

import { program } from 'commander';
import { readFile } from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { Trip } from '../models/Trip';
import { User } from '../models/User';
import { connectToDatabase } from '../utils/database';

// CLI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  title: (msg: string) => console.log(`${colors.bright}${colors.cyan}🚀 ${msg}${colors.reset}`),
};

/**
 * Connect to database with error handling
 */
const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';
    await mongoose.connect(mongoUri);
    log.success('Connected to database');
  } catch (error) {
    log.error(`Failed to connect to database: ${(error as Error).message}`);
    process.exit(1);
  }
};

/**
 * Gracefully close database connection
 */
const closeDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    log.success('Database connection closed');
  } catch (error) {
    log.error(`Error closing database: ${(error as Error).message}`);
  }
};

/**
 * List all trips command
 */
const listTrips = async (options: { limit?: string; status?: string }) => {
  log.title('Listing trips...');
  
  try {
    await connectDB();
    
    const filter: any = {};
    if (options.status) {
      filter.status = options.status;
    }
    
    const limit = options.limit ? parseInt(options.limit) : 10;
    const trips = await Trip.find(filter)
      .limit(limit)
      .populate('organizerId', 'name email')
      .sort({ createdAt: -1 });
    
    if (trips.length === 0) {
      log.warning('No trips found');
      return;
    }
    
    console.log('\n📋 Trips List:');
    console.log(''.padEnd(80, '='));
    
    trips.forEach((trip, index) => {
      const organizer = trip.organizerId as any;
      console.log(`${index + 1}. ${colors.bright}${trip.title}${colors.reset}`);
      console.log(`   📍 Destination: ${trip.destination}`);
      console.log(`   👤 Organizer: ${organizer?.name || 'Unknown'}`);
      console.log(`   💰 Price: ₹${trip.price}`);
      console.log(`   👥 Capacity: ${trip.participants.length}/${trip.capacity}`);
      console.log(`   📅 Dates: ${trip.startDate.toDateString()} - ${trip.endDate.toDateString()}`);
      console.log(''.padEnd(40, '-'));
    });
    
    log.success(`Found ${trips.length} trip(s)`);
    
  } catch (error) {
    log.error(`Failed to list trips: ${(error as Error).message}`);
  } finally {
    await closeDB();
  }
};

/**
 * Create a trip from JSON file command
 */
const createTripFromFile = async (filePath: string) => {
  log.title(`Creating trip from file: ${filePath}`);
  
  try {
    await connectDB();
    
    // Read and parse JSON file
    const absolutePath = path.resolve(filePath);
    log.info(`Reading file: ${absolutePath}`);
    
    const fileContent = await readFile(absolutePath, 'utf-8');
    const tripData = JSON.parse(fileContent);
    
    // Validate required fields
    const requiredFields = ['title', 'description', 'destination', 'price', 'capacity', 'startDate', 'endDate'];
    const missingFields = requiredFields.filter(field => !tripData[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    // Create trip
    const trip = new Trip({
      ...tripData,
      startDate: new Date(tripData.startDate),
      endDate: new Date(tripData.endDate),
      organizerId: tripData.organizerId || new mongoose.Types.ObjectId(),
      participants: [],
      categories: tripData.categories || [],
    });
    
    await trip.save();
    
    log.success(`Trip created successfully!`);
    console.log(`   ID: ${trip._id}`);
    console.log(`   Title: ${trip.title}`);
    console.log(`   Destination: ${trip.destination}`);
    
  } catch (error) {
    if (error instanceof SyntaxError) {
      log.error('Invalid JSON format in file');
    } else {
      log.error(`Failed to create trip: ${(error as Error).message}`);
    }
  } finally {
    await closeDB();
  }
};

/**
 * Delete trip command
 */
const deleteTrip = async (tripId: string) => {
  log.title(`Deleting trip: ${tripId}`);
  
  try {
    await connectDB();
    
    const trip = await Trip.findById(tripId);
    if (!trip) {
      log.warning('Trip not found');
      return;
    }
    
    console.log(`Found trip: ${trip.title}`);
    
    // In a real CLI, you might want to add confirmation
    await Trip.findByIdAndDelete(tripId);
    
    log.success('Trip deleted successfully');
    
  } catch (error) {
    if ((error as any).kind === 'ObjectId') {
      log.error('Invalid trip ID format');
    } else {
      log.error(`Failed to delete trip: ${(error as Error).message}`);
    }
  } finally {
    await closeDB();
  }
};

/**
 * Show trip statistics
 */
const showStats = async () => {
  log.title('Generating trip statistics...');
  
  try {
    await connectDB();
    
    // Run multiple async operations in parallel
    const [
      totalTrips,
      activeTrips,
      totalUsers,
      organizerCount,
      avgPrice
    ] = await Promise.all([
      Trip.countDocuments(),
      Trip.countDocuments({ status: 'active' }),
      User.countDocuments(),
      User.countDocuments({ role: 'organizer' }),
      Trip.aggregate([
        { $group: { _id: null, avgPrice: { $avg: '$price' } } }
      ])
    ]);
    
    console.log('\n📊 TrekkTribe Statistics:');
    console.log(''.padEnd(40, '='));
    console.log(`🎯 Total Trips: ${totalTrips}`);
    console.log(`✅ Active Trips: ${activeTrips}`);
    console.log(`👥 Total Users: ${totalUsers}`);
    console.log(`🎪 Organizers: ${organizerCount}`);
    console.log(`💰 Average Price: ₹${avgPrice[0]?.avgPrice?.toFixed(2) || '0.00'}`);
    
    // Most popular destinations
    const popularDestinations = await Trip.aggregate([
      { $group: { _id: '$destination', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    if (popularDestinations.length > 0) {
      console.log('\n🏔️ Top Destinations:');
      popularDestinations.forEach((dest, index) => {
        console.log(`   ${index + 1}. ${dest._id} (${dest.count} trips)`);
      });
    }
    
    log.success('Statistics generated successfully');
    
  } catch (error) {
    log.error(`Failed to generate statistics: ${(error as Error).message}`);
  } finally {
    await closeDB();
  }
};

/**
 * Export data command (demonstrates file writing)
 */
const exportData = async (outputFile: string) => {
  log.title(`Exporting data to: ${outputFile}`);
  
  try {
    await connectDB();
    
    const trips = await Trip.find().populate('organizerId', 'name email');
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalTrips: trips.length,
      trips: trips.map(trip => ({
        id: trip._id,
        title: trip.title,
        destination: trip.destination,
        price: trip.price,
        capacity: trip.capacity,
        participants: trip.participants.length,
        organizer: (trip.organizerId as any)?.name || 'Unknown',
        startDate: trip.startDate.toISOString(),
        endDate: trip.endDate.toISOString(),
      }))
    };
    
    // Write to file
    const { writeFile } = await import('fs/promises');
    await writeFile(outputFile, JSON.stringify(exportData, null, 2));
    
    log.success(`Data exported to ${outputFile}`);
    log.info(`Exported ${trips.length} trips`);
    
  } catch (error) {
    log.error(`Failed to export data: ${(error as Error).message}`);
  } finally {
    await closeDB();
  }
};

// Define CLI commands
program
  .name('trip-manager')
  .description('CLI for managing TrekkTribe trips')
  .version('1.0.0');

program
  .command('list')
  .description('List all trips')
  .option('-l, --limit <number>', 'limit number of results', '10')
  .option('-s, --status <status>', 'filter by status')
  .action(listTrips);

program
  .command('create')
  .description('Create a trip from JSON file')
  .argument('<file>', 'path to JSON file containing trip data')
  .action(createTripFromFile);

program
  .command('delete')
  .description('Delete a trip')
  .argument('<id>', 'trip ID to delete')
  .action(deleteTrip);

program
  .command('stats')
  .description('Show trip statistics')
  .action(showStats);

program
  .command('export')
  .description('Export trip data to JSON file')
  .argument('<file>', 'output file path')
  .action(exportData);

// Handle errors and show help for unknown commands
program.on('command:*', () => {
  log.error('Invalid command. Use --help to see available commands.');
  process.exit(1);
});

// Global error handlers
process.on('uncaughtException', (error) => {
  log.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
