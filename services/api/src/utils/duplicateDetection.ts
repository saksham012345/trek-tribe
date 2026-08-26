import crypto from 'crypto';
import { hashWithSalt } from './cryptoUtils';
import { prisma } from '../lib/prisma';
import { shapeTrip } from '../services/tripShapeService';
import { User } from '../models/User';
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
    organizerId: { not: String(tripData.organizerId) }, // Only check for duplicates from other organizers
    status: { in: ['active', 'completed'] }
  };

  // Exclude current trip if updating
  if (tripData._id) {
    query.id = { not: String(tripData._id) };
  }

  const existingTrip = await prisma.trip.findFirst({ where: query });
  if (!existingTrip) return null;

  // populate('organizerId') is gone; the organizer is a Mongo document.
  const organizer = await User.findById(existingTrip.organizerId)
    .select('name email organizerProfile.companyName')
    .lean();

  return { ...shapeTrip(existingTrip), organizerId: organizer ?? existingTrip.organizerId };
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

  // new RegExp(destination, 'i') read a user-supplied destination as a regular
  // expression: a value containing metacharacters was a pattern rather than
  // text, and could be made expensive to evaluate. `contains` with insensitive
  // mode is the same match, on text.
  const similarTripRows = await prisma.trip.findMany({
    where: {
      destination: { contains: tripData.destination, mode: 'insensitive' },
      startDate: { gte: dateRangeStart, lte: dateRangeEnd },
      organizerId: { not: String(tripData.organizerId) },
      status: 'active'
    }
  });

  const similarOrganizerIds = Array.from(new Set(similarTripRows.map(t => t.organizerId)));
  const similarOrganizers = similarOrganizerIds.length
    ? await User.find({ _id: { $in: similarOrganizerIds } }, 'name email').lean()
    : [];
  const similarOrganizerById = new Map(similarOrganizers.map((u: any) => [u._id.toString(), u]));

  const similarTrips = similarTripRows.map(row => ({
    ...shapeTrip(row),
    organizerId: similarOrganizerById.get(row.organizerId) ?? row.organizerId
  }));

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
  const updated = await prisma.trip.update({
    where: { id: String(tripId) },
    data: {
      isDuplicate: true,
      originalTripId: String(originalTripId),
      status: 'cancelled' // Automatically cancel duplicate trips
    }
  }).catch((error: any) => {
    if (error?.code === 'P2025') return null;
    throw error;
  });

  if (!updated) {
    throw new Error('Trip not found');
  }

  return shapeTrip(updated);
}

/**
 * Get duplicate statistics for admin dashboard
 */
export async function getDuplicateStats() {
  const [totalDuplicates, recentRows, byOrganizerGroups] = await Promise.all([
    prisma.trip.count({ where: { isDuplicate: true } }),
    prisma.trip.findMany({
      where: { isDuplicate: true },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    prisma.trip.groupBy({
      by: ['organizerId'],
      where: { isDuplicate: true },
      _count: { organizerId: true },
      orderBy: { _count: { organizerId: 'desc' } },
      take: 10
    })
  ]);

  // originalTripId is a plain column rather than a populated ref, so the
  // originals are fetched by id.
  const originalIds = recentRows.map(t => t.originalTripId).filter(Boolean) as string[];
  const [dupOrganizers, originals] = await Promise.all([
    User.find(
      { _id: { $in: recentRows.map(t => t.organizerId) } },
      'name email'
    ).lean(),
    originalIds.length
      ? prisma.trip.findMany({
          where: { id: { in: originalIds } },
          select: { id: true, title: true, destination: true }
        })
      : []
  ]);

  const dupOrganizerById = new Map<string, any>(dupOrganizers.map((u: any) => [u._id.toString(), u] as [string, any]));
  const originalById = new Map<string, any>(originals.map(t => [t.id, t] as [string, any]));

  const recentDuplicates = recentRows.map(row => ({
    ...shapeTrip(row),
    organizerId: dupOrganizerById.get(row.organizerId) ?? row.organizerId,
    originalTripId: row.originalTripId ? originalById.get(row.originalTripId) ?? row.originalTripId : null
  }));

  const duplicatesByOrganizer = byOrganizerGroups.map(g => ({
    _id: g.organizerId,
    count: g._count.organizerId
  }));

  return {
    total: totalDuplicates,
    recent: recentDuplicates,
    byOrganizer: duplicatesByOrganizer
  };
}
