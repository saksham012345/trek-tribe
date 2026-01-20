import crypto from 'crypto';
import { hashWithSalt } from './cryptoUtils';
import { Trip } from '../models/Trip';
import { Types } from 'mongoose';

/**
 * Generate a content hash for duplicate detection
 * Uses title, destination, and start date as unique identifiers with salt
 */
export function generateContentHash(tripData: {
  title: string;
  destination: string;
  startDate: Date;
}): string {
  const normalizedContent = [
    tripData.title.toLowerCase().trim(),
    tripData.destination.toLowerCase().trim(),
    new Date(tripData.startDate).toISOString().split('T')[0] // Date only
  ].join('|');

  // Use a constant salt for deterministic duplicate detection across trips
  return hashWithSalt(normalizedContent, 'trip-content-salt');
}


/**
 * Check if a trip is a duplicate of an existing trip
 * Returns the original trip if duplicate found, null otherwise
 */
export async function detectDuplicateTrip(tripData: {
  title: string;
  destination: string;
  startDate: Date;
  organizerId: Types.ObjectId;
  _id?: Types.ObjectId;
}) {
  const contentHash = generateContentHash(tripData);

  const query: any = {
    contentHash,
    organizerId: { $ne: tripData.organizerId }, // Only check for duplicates from other organizers
    status: { $in: ['active', 'completed'] }
  };

  // Exclude current trip if updating
  if (tripData._id) {
    query._id = { $ne: tripData._id };
  }

  const existingTrip = await Trip.findOne(query)
    .select('title destination startDate organizerId createdAt')
    .populate('organizerId', 'name email organizerProfile.companyName');

  return existingTrip;
}

/**
 * Advanced duplicate detection with similarity scoring
 * Returns a similarity score (0-100) and potential duplicates
 */
export async function detectSimilarTrips(tripData: {
  title: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  price: number;
  organizerId: Types.ObjectId;
}, options: {
  titleSimilarityThreshold?: number;
  dateDifferenceThreshold?: number;
  priceDifferenceThreshold?: number;
} = {}) {
  const {
    titleSimilarityThreshold = 0.7,
    dateDifferenceThreshold = 7, // days
    priceDifferenceThreshold = 0.2 // 20% difference
  } = options;

  const startDateObj = new Date(tripData.startDate);
  const endDateObj = new Date(tripData.endDate);

  // Find trips in the same destination around the same dates
  const dateRangeStart = new Date(startDateObj);
  dateRangeStart.setDate(dateRangeStart.getDate() - dateDifferenceThreshold);

  const dateRangeEnd = new Date(endDateObj);
  dateRangeEnd.setDate(dateRangeEnd.getDate() + dateDifferenceThreshold);

  const similarTrips = await Trip.find({
    destination: new RegExp(tripData.destination, 'i'),
    startDate: { $gte: dateRangeStart, $lte: dateRangeEnd },
    organizerId: { $ne: tripData.organizerId },
    status: 'active'
  })
    .select('title destination startDate endDate price organizerId averageRating reviewCount')
    .populate('organizerId', 'name email');

  const results = similarTrips.map(trip => {
    // Calculate title similarity (Levenshtein distance)
    const titleSimilarity = calculateStringSimilarity(
      tripData.title.toLowerCase(),
      trip.title.toLowerCase()
    );

    // Calculate date difference
    const dateDiff = Math.abs(
      new Date(trip.startDate).getTime() - startDateObj.getTime()
    ) / (1000 * 60 * 60 * 24);

    // Calculate price difference
    const priceDiff = Math.abs(trip.price - tripData.price) / tripData.price;

    // Calculate overall similarity score
    const similarityScore = calculateSimilarityScore({
      titleSimilarity,
      dateDiff,
      priceDiff,
      dateDifferenceThreshold,
      priceDifferenceThreshold
    });

    return {
      trip: trip.toObject(),
      similarity: {
        score: similarityScore,
        titleMatch: titleSimilarity,
        dateDifference: Math.round(dateDiff),
        priceDifference: Math.round(priceDiff * 100),
        isDuplicate: similarityScore >= 80
      }
    };
  });

  // Sort by similarity score (highest first)
  results.sort((a, b) => b.similarity.score - a.similarity.score);

  return {
    potentialDuplicates: results.filter(r => r.similarity.isDuplicate),
    similarTrips: results.filter(r => !r.similarity.isDuplicate && r.similarity.score >= 50),
    allResults: results
  };
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 (no similarity) and 1 (identical)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) return 1;

  return 1 - distance / maxLength;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate overall similarity score (0-100)
 */
function calculateSimilarityScore(params: {
  titleSimilarity: number;
  dateDiff: number;
  priceDiff: number;
  dateDifferenceThreshold: number;
  priceDifferenceThreshold: number;
}): number {
  const {
    titleSimilarity,
    dateDiff,
    priceDiff,
    dateDifferenceThreshold,
    priceDifferenceThreshold
  } = params;

  // Weight different factors
  const titleWeight = 0.5;
  const dateWeight = 0.3;
  const priceWeight = 0.2;

  // Title similarity (0-100)
  const titleScore = titleSimilarity * 100;

  // Date proximity score (0-100)
  const dateScore = Math.max(
    0,
    100 - (dateDiff / dateDifferenceThreshold) * 100
  );

  // Price similarity score (0-100)
  const priceScore = Math.max(
    0,
    100 - (priceDiff / priceDifferenceThreshold) * 100
  );

  // Weighted average
  const overallScore =
    titleScore * titleWeight +
    dateScore * dateWeight +
    priceScore * priceWeight;

  return Math.round(Math.min(100, Math.max(0, overallScore)));
}

/**
 * Mark a trip as duplicate and link to original
 */
export async function markAsDuplicate(
  tripId: Types.ObjectId,
  originalTripId: Types.ObjectId
) {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new Error('Trip not found');
  }

  trip.isDuplicate = true;
  trip.originalTripId = originalTripId;
  trip.status = 'cancelled'; // Automatically cancel duplicate trips

  await trip.save();

  return trip;
}

/**
 * Get duplicate statistics for admin dashboard
 */
export async function getDuplicateStats() {
  const totalDuplicates = await Trip.countDocuments({ isDuplicate: true });

  const recentDuplicates = await Trip.find({ isDuplicate: true })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('organizerId', 'name email')
    .populate('originalTripId', 'title destination');

  const duplicatesByOrganizer = await Trip.aggregate([
    { $match: { isDuplicate: true } },
    { $group: { _id: '$organizerId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  return {
    total: totalDuplicates,
    recent: recentDuplicates,
    byOrganizer: duplicatesByOrganizer
  };
}
