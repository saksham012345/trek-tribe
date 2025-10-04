import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface RatingDocument extends Document {
  userId: Types.ObjectId;
  tripId: Types.ObjectId;
  organizerId: Types.ObjectId;
  tripRating: number; // 1-5 stars for trip experience
  organizerRating: number; // 1-5 stars for organizer
  comment?: string;
  tags?: string[]; // e.g., ['great-guide', 'beautiful-location', 'well-organized']
  isVerified: boolean; // To prevent fake reviews
  flaggedAsFake?: boolean;
  flaggedBy?: Types.ObjectId[];
  moderationStatus: 'pending' | 'approved' | 'rejected';
  images?: string[]; // Optional review images
  helpfulVotes: number;
  unhelpfulVotes: number;
  createdAt: Date;
  updatedAt: Date;
}

const ratingSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tripRating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5,
      validate: {
        validator: function(v: number) {
          return Number.isInteger(v * 2); // Allow half stars (0.5 increments)
        },
        message: 'Rating must be in increments of 0.5'
      }
    },
    organizerRating: { 
      type: Number, 
      required: true, 
      min: 1, 
      max: 5,
      validate: {
        validator: function(v: number) {
          return Number.isInteger(v * 2);
        },
        message: 'Rating must be in increments of 0.5'
      }
    },
    comment: { type: String, maxlength: 1000 },
    tags: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    flaggedAsFake: { type: Boolean, default: false },
    flaggedBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    moderationStatus: { 
      type: String, 
      enum: ['pending', 'approved', 'rejected'], 
      default: 'pending',
      index: true 
    },
    images: [{ type: String }],
    helpfulVotes: { type: Number, default: 0 },
    unhelpfulVotes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Compound index to ensure one rating per user per trip
ratingSchema.index({ userId: 1, tripId: 1 }, { unique: true });

// Text index for searching comments
ratingSchema.index({ comment: 'text', tags: 'text' });

export const Rating = (mongoose.models.Rating || mongoose.model('Rating', ratingSchema)) as any as Model<RatingDocument>;