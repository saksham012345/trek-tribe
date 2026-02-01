/**
 * Trust Score Calculation Service
 * Calculates and updates organizer trust scores based on multiple factors
 */

import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { Review } from '../models/Review';
import { logger } from '../utils/logger';
import chatService from './chatService'; // Correct default import

export interface TrustScoreBreakdown {
  documentVerified: number;    // 0-20 points
  bankVerified: number;        // 0-20 points
  experienceYears: number;     // 0-15 points
  completedTrips: number;      // 0-15 points
  userReviews: number;         // 0-15 points
  responseTime: number;        // 0-10 points
  refundRate: number;          // 0-5 points
}

export interface TrustScore {
  overall: number;
  breakdown: TrustScoreBreakdown;
  lastCalculated: Date;
}

export class TrustScoreService {
  /**
   * Calculate comprehensive trust score for an organizer
   */
  static async calculateTrustScore(organizerId: string): Promise<TrustScore> {
    try {
      const organizer = await User.findById(organizerId);
      if (!organizer || organizer.role !== 'organizer') {
        throw new Error('Organizer not found');
      }

      const breakdown: TrustScoreBreakdown = {
        documentVerified: 0,
        bankVerified: 0,
        experienceYears: 0,
        completedTrips: 0,
        userReviews: 0,
        responseTime: 0,
        refundRate: 0
      };

      // 1. Document Verification (0-20 points)
      if (organizer.organizerVerificationStatus === 'approved') {
        breakdown.documentVerified = 20;
      } else if (organizer.organizerVerificationStatus === 'pending') {
        breakdown.documentVerified = 5;
      }

      // 2. Bank Account Verification (0-20 points)
      if (organizer.organizerProfile?.bankDetails?.accountNumber) {
        breakdown.bankVerified = 15; // Has bank details

        // Extra points if Razorpay account is linked
        if (organizer.organizerProfile?.razorpayRouteId) {
          breakdown.bankVerified = 20;
        }
      }

      // 3. Years of Experience (0-15 points)
      const yearsOfExperience = organizer.organizerProfile?.yearsOfExperience || 0;
      if (yearsOfExperience >= 10) {
        breakdown.experienceYears = 15;
      } else if (yearsOfExperience >= 5) {
        breakdown.experienceYears = 12;
      } else if (yearsOfExperience >= 3) {
        breakdown.experienceYears = 9;
      } else if (yearsOfExperience >= 1) {
        breakdown.experienceYears = 5;
      }

      // 4. Completed Trips (0-15 points)
      const trips = await Trip.find({
        organizerId,
        status: 'completed'
      });

      const completedTripsCount = trips.length;
      if (completedTripsCount >= 50) {
        breakdown.completedTrips = 15;
      } else if (completedTripsCount >= 25) {
        breakdown.completedTrips = 13;
      } else if (completedTripsCount >= 10) {
        breakdown.completedTrips = 10;
      } else if (completedTripsCount >= 5) {
        breakdown.completedTrips = 7;
      } else if (completedTripsCount >= 1) {
        breakdown.completedTrips = 3;
      }

      // 5. User Reviews & Ratings (0-15 points)
      const reviews = await Review.find({
        tripId: { $in: trips.map(t => t._id) }
      });

      if (reviews.length > 0) {
        const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        const reviewCount = reviews.length;

        // Base score on average rating
        let ratingScore = 0;
        if (averageRating >= 4.8) ratingScore = 12;
        else if (averageRating >= 4.5) ratingScore = 10;
        else if (averageRating >= 4.0) ratingScore = 7;
        else if (averageRating >= 3.5) ratingScore = 4;
        else if (averageRating >= 3.0) ratingScore = 2;

        // Bonus for review count
        let reviewBonus = 0;
        if (reviewCount >= 100) reviewBonus = 3;
        else if (reviewCount >= 50) reviewBonus = 2;
        else if (reviewCount >= 10) reviewBonus = 1;

        breakdown.userReviews = Math.min(ratingScore + reviewBonus, 15);
      }

      // 6. Response Time (0-10 points)
      // For now, assign based on verification status
      // In a real implementation, we would query ChatService for average response times
      if (organizer.organizerVerificationStatus === 'approved') {
        // Mock calculation: 
        // 10 points for < 1 hour
        // 8 points for < 4 hours
        // 5 points for < 24 hours
        breakdown.responseTime = 8;
      } else {
        breakdown.responseTime = 2;
      }

      // 7. Refund/Cancellation Rate (0-5 points)
      // Lower refund rate = higher score
      const totalTrips = await Trip.countDocuments({ organizerId });
      const cancelledTrips = await Trip.countDocuments({
        organizerId,
        status: 'cancelled'
      });

      if (totalTrips > 0) {
        const cancellationRate = cancelledTrips / totalTrips;

        if (cancellationRate <= 0.05) {
          breakdown.refundRate = 5;  // ≤5% cancellation
        } else if (cancellationRate <= 0.10) {
          breakdown.refundRate = 4;  // ≤10% cancellation
        } else if (cancellationRate <= 0.15) {
          breakdown.refundRate = 3;  // ≤15% cancellation
        } else if (cancellationRate <= 0.25) {
          breakdown.refundRate = 2;  // ≤25% cancellation
        } else {
          breakdown.refundRate = 1;  // >25% cancellation
        }
      } else {
        // New organizer, give benefit of doubt
        breakdown.refundRate = 3;
      }

      // Calculate overall score
      const overall = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

      const trustScore: TrustScore = {
        overall,
        breakdown,
        lastCalculated: new Date()
      };

      logger.info('Trust score calculated', {
        organizerId,
        overall,
        breakdown
      });

      return trustScore;
    } catch (error: any) {
      logger.error('Error calculating trust score', {
        organizerId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update organizer's trust score in database
   */
  static async updateOrganizerTrustScore(organizerId: string): Promise<TrustScore> {
    const trustScore = await this.calculateTrustScore(organizerId);

    await User.findByIdAndUpdate(organizerId, {
      'organizerProfile.trustScore': trustScore
    });

    logger.info('Organizer trust score updated', {
      organizerId,
      score: trustScore.overall
    });

    return trustScore;
  }

  /**
   * Determine verification badge based on trust score
   */
  static getBadgeForScore(score: number): 'none' | 'bronze' | 'silver' | 'gold' | 'platinum' {
    if (score >= 95) return 'platinum';
    if (score >= 85) return 'gold';
    if (score >= 70) return 'silver';
    if (score >= 50) return 'bronze';
    return 'none';
  }

  /**
   * Check if organizer is eligible for payment routing
   */
  static isEligibleForRouting(trustScore: number): boolean {
    const minScore = parseInt(process.env.MIN_TRUST_SCORE_FOR_ROUTING || '70');
    return trustScore >= minScore;
  }

  /**
   * Get trust score recommendations for improvement
   */
  static getImprovementRecommendations(breakdown: TrustScoreBreakdown): string[] {
    const recommendations: string[] = [];

    if (breakdown.documentVerified < 20) {
      recommendations.push('Complete KYC document verification to earn up to 20 points');
    }

    if (breakdown.bankVerified < 20) {
      recommendations.push('Add and verify bank account details to earn up to 20 points');
    }

    if (breakdown.completedTrips < 10) {
      recommendations.push('Successfully complete more trips to increase your score (up to 15 points)');
    }

    if (breakdown.userReviews < 10) {
      recommendations.push('Encourage travelers to leave reviews after trips (up to 15 points)');
    }

    if (breakdown.refundRate < 4) {
      recommendations.push('Reduce cancellation rate to improve reliability score');
    }

    if (recommendations.length === 0) {
      recommendations.push('Excellent! Maintain your current performance to keep your high trust score.');
    }

    return recommendations;
  }

  /**
   * Batch update trust scores for all organizers
   * Run this periodically (e.g., daily cron job)
   */
  static async updateAllOrganizerScores(): Promise<void> {
    try {
      const organizers = await User.find({
        role: 'organizer',
        organizerVerificationStatus: 'approved'
      }).select('_id');

      logger.info('Starting batch trust score update', {
        count: organizers.length
      });

      let updated = 0;
      let failed = 0;

      for (const organizer of organizers) {
        try {
          await this.updateOrganizerTrustScore(organizer._id.toString());
          updated++;
        } catch (error: any) {
          logger.error('Failed to update trust score', {
            organizerId: organizer._id,
            error: error.message
          });
          failed++;
        }
      }

      logger.info('Batch trust score update completed', {
        total: organizers.length,
        updated,
        failed
      });
    } catch (error: any) {
      logger.error('Error in batch trust score update', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Hook to be called when a trip is completed
   */
  static async onTripCompleted(organizerId: string): Promise<void> {
    await this.updateOrganizerTrustScore(organizerId);
  }

  /**
   * Hook to be called when a review is added/verified
   */
  static async onReviewAdded(organizerId: string): Promise<void> {
    await this.updateOrganizerTrustScore(organizerId);
  }
}

export default TrustScoreService;
