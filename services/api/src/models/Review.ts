import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Node.js Concept: Custom Modules - Creating reusable model definitions
// This demonstrates ES6 modules (import/export) vs CommonJS (require/module.exports)

export type ReviewType = 'trip' | 'organizer';

export interface ReviewDocument extends Document {
  reviewerId: Types.ObjectId;
  userId?: Types.ObjectId; // Alternative reference to user
  targetId: Types.ObjectId; // Trip ID or Organizer ID
  tripId?: Types.ObjectId; // Direct trip reference
  reviewType: ReviewType;
  rating: number; // 1-5 scale
  title: string;
  comment: string;
  images?: string[]; // Optional review images
  tags?: string[]; // e.g., ['safety', 'value-for-money', 'organization']
  isVerified: boolean; // Only verified participants can review
  helpfulVotes: number;
  helpfulVoters: Types.ObjectId[]; // Users who found this review helpful
  organizerResponse?: {
    message: string;
    respondedAt: Date;
  };
  tripDate?: Date; // When the trip occurred (for trip reviews)
  // Verification and moderation fields
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  verificationNotes?: string;
  isRejected?: boolean;
  rejectedAt?: Date;
  rejectedBy?: Types.ObjectId;
  rejectionReason?: string;
  isFlagged?: boolean;
  flaggedAt?: Date;
  flags?: Array<{
    userId: Types.ObjectId;
    reason: string;
    flaggedAt: Date;
  }>;
  moderatedAt?: Date;
  moderatedBy?: Types.ObjectId;
  moderationNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  markAsHelpful(userId: Types.ObjectId): Promise<ReviewDocument>;
}

// Advanced schema with validation and indexing
// Define schema without explicit generic type to avoid union complexity
const reviewSchema = new Schema(
  {
    reviewerId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    targetId: { 
      type: Schema.Types.ObjectId, 
      required: true,
      index: true 
    },
    reviewType: { 
      type: String, 
      enum: ['trip', 'organizer'], 
      required: true,
      index: true 
    },
    rating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number between 1 and 5'
      }
    },
    title: { 
      type: String, 
      required: true, 
      maxlength: 100,
      trim: true
    },
    comment: { 
      type: String, 
      required: true, 
      minlength: 10,
      maxlength: 1000,
      trim: true
    },
    images: [{ 
      type: String,
      validate: {
        validator: function(v: string) {
          return /^https?:\/\/.+\.(jpg|jpeg|png|webp)$/i.test(v);
        },
        message: 'Invalid image URL format'
      }
    }],
    tags: [{ 
      type: String,
      lowercase: true,
      trim: true,
      enum: [
        'safety', 'value-for-money', 'organization', 'communication',
        'accommodation', 'food', 'activities', 'guide-quality',
        'group-size', 'timing', 'location', 'equipment'
      ]
    }],
    isVerified: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    helpfulVotes: { 
      type: Number, 
      default: 0,
      min: 0
    },
    helpfulVoters: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    }],
    organizerResponse: {
      message: { 
        type: String, 
        maxlength: 500,
        trim: true
      },
      respondedAt: Date
    },
    tripDate: Date,
    // Verification and moderation fields
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      index: true 
    },
    tripId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Trip',
      index: true 
    },
    verifiedAt: Date,
    verifiedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    verificationNotes: String,
    isRejected: { 
      type: Boolean, 
      default: false 
    },
    rejectedAt: Date,
    rejectedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    rejectionReason: String,
    isFlagged: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    flaggedAt: Date,
    flags: [{
      userId: { 
        type: Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
      },
      reason: { 
        type: String, 
        required: true 
      },
      flaggedAt: { 
        type: Date, 
        default: Date.now 
      }
    }],
    moderatedAt: Date,
    moderatedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User' 
    },
    moderationNotes: String
  },
  { 
    timestamps: true,
    // Node.js Concept: Schema options and middleware
    toJSON: { 
      virtuals: true,
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
        if ('_id' in ret) delete ret._id;
        if ('__v' in ret) delete ret.__v;
        return ret;
      }
    }
  }
);

// Node.js Concept: Database Indexing for Performance
// Compound indexes for common queries
reviewSchema.index({ targetId: 1, reviewType: 1, rating: -1 });
reviewSchema.index({ reviewerId: 1, createdAt: -1 });
reviewSchema.index({ reviewType: 1, isVerified: 1, createdAt: -1 });
reviewSchema.index({ rating: -1, helpfulVotes: -1 }); // For sorting by best reviews

// Text index for search functionality
reviewSchema.index({ 
  title: 'text', 
  comment: 'text', 
  tags: 'text' 
});

// Node.js Concept: Mongoose Virtual Properties
// Calculate average rating without storing it
reviewSchema.virtual('isRecent').get(function(this: any) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  return this.createdAt > oneMonthAgo;
});

// Node.js Concept: Mongoose Middleware (Pre/Post hooks)
// Prevent duplicate reviews
reviewSchema.pre('save', async function(next) {
  try {
    if (this.isNew) {
      const existingReview = await Review.findOne({
        reviewerId: this.reviewerId,
        targetId: this.targetId,
        reviewType: this.reviewType
      });

      if (existingReview) {
        const error = new Error('You have already reviewed this ' + this.reviewType);
        (error as any).statusCode = 409;
        throw error;
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Static method for calculating average ratings
// Node.js Concept: Custom static methods on models
reviewSchema.statics.calculateAverageRating = async function(targetId: Types.ObjectId, reviewType: ReviewType) {
  const result = await this.aggregate([
    { 
      $match: { 
        targetId, 
        reviewType, 
        isVerified: true 
      } 
    },
    { 
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  // Calculate rating distribution
  const distribution = result[0].ratingDistribution.reduce((acc: any, rating: number) => {
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  return {
    averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
    totalReviews: result[0].totalReviews,
    ratingDistribution: distribution
  };
};

// Instance method for marking review as helpful
// Node.js Concept: Instance methods on documents
reviewSchema.methods.markAsHelpful = async function(userId: Types.ObjectId) {
  if (this.helpfulVoters.includes(userId)) {
    // Remove vote if already voted
    this.helpfulVoters = this.helpfulVoters.filter((id: Types.ObjectId) => 
      !id.equals(userId)
    );
    this.helpfulVotes = Math.max(0, this.helpfulVotes - 1);
  } else {
    // Add vote
    this.helpfulVoters.push(userId);
    this.helpfulVotes += 1;
  }
  
  return await this.save();
};

// Define model interface with static methods
interface ReviewModel extends Model<ReviewDocument> {
  calculateAverageRating(targetId: Types.ObjectId, reviewType: ReviewType): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Record<number, number>;
  }>;
}

// Use a simpler approach to avoid complex union types
const ReviewModel = mongoose.models.Review || mongoose.model('Review', reviewSchema);
export const Review = ReviewModel as ReviewModel;

// Node.js Concept: Module Exports
// Export both the model and types for use in other files
export default Review;
