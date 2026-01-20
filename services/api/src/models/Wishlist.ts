import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Node.js Concept: TypeScript interfaces for type safety
export interface WishlistDocument extends Document {
  userId: Types.ObjectId;
  tripId: Types.ObjectId;
  notes?: string; // Personal notes about why they saved this trip
  priority: 'low' | 'medium' | 'high';
  tags: string[]; // Personal tags for organization
  createdAt: Date;
  updatedAt: Date;
  // Instance methods
  updatePriority(newPriority: 'low' | 'medium' | 'high'): Promise<WishlistDocument>;
  addTags(newTags: string[]): Promise<WishlistDocument>;
  removeTags(tagsToRemove: string[]): Promise<WishlistDocument>;
}

// Node.js Concept: Schema design with validation and indexing
// Define schema without explicit generic type to avoid union complexity
const wishlistSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true
    },
    tags: [{
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 50
    }]
  },
  {
    timestamps: true,
    // Transform output to include 'id' instead of '_id'
    toJSON: {
      virtuals: true,
      transform: function (doc: any, ret: any) {
        ret.id = ret._id;
        if ('_id' in ret) delete ret._id;
        if ('__v' in ret) delete ret.__v;
        return ret;
      }
    }
  }
);

// Node.js Concept: Compound indexes for performance
// Ensure one user can only bookmark a trip once
wishlistSchema.index({ userId: 1, tripId: 1 }, { unique: true });

// Index for user's wishlist queries
wishlistSchema.index({ userId: 1, priority: -1, createdAt: -1 });

// Index for filtering by tags
wishlistSchema.index({ userId: 1, tags: 1 });

// Node.js Concept: Mongoose Pre-hooks for validation
wishlistSchema.pre('save', async function (next) {
  try {
    if (this.isNew) {
      // Check if trip exists
      const Trip = mongoose.model('Trip');
      const trip = await Trip.findById(this.tripId);

      if (!trip) {
        const error = new Error('Trip not found');
        (error as any).statusCode = 404;
        throw error;
      }

      // Check if trip is still active
      if (trip.status !== 'active') {
        const error = new Error('Cannot bookmark inactive trips');
        (error as any).statusCode = 400;
        throw error;
      }
    }
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Node.js Concept: Static methods for complex queries
wishlistSchema.statics.getUserWishlistWithTrips = async function (
  userId: Types.ObjectId,
  options: {
    priority?: string;
    tags?: string[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}
) {
  const {
    priority,
    tags,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 10
  } = options;

  // Build match stage for aggregation
  const matchStage: any = { userId };

  if (priority) matchStage.priority = priority;
  if (tags && tags.length > 0) matchStage.tags = { $in: tags };

  // Build sort stage
  const sortStage: any = {};
  sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const skip = (page - 1) * limit;

  // Aggregation pipeline to join with trip data
  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'trips',
        localField: 'tripId',
        foreignField: '_id',
        as: 'trip'
      }
    },
    { $unwind: '$trip' },
    // Only return active trips
    { $match: { 'trip.status': 'active' } },
    {
      $lookup: {
        from: 'users',
        localField: 'trip.organizerId',
        foreignField: '_id',
        as: 'organizer'
      }
    },
    { $unwind: '$organizer' },
    {
      $project: {
        _id: 1,
        notes: 1,
        priority: 1,
        tags: 1,
        createdAt: 1,
        updatedAt: 1,
        'trip._id': 1,
        'trip.title': 1,
        'trip.description': 1,
        'trip.destination': 1,
        'trip.price': 1,
        'trip.startDate': 1,
        'trip.endDate': 1,
        'trip.capacity': 1,
        'trip.images': 1,
        'trip.coverImage': 1,
        'trip.categories': 1,
        'organizer._id': 1,
        'organizer.name': 1,
        'organizer.email': 1
      }
    },
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit }
  ];

  const [results, totalCount] = await Promise.all([
    this.aggregate(pipeline),
    this.countDocuments(matchStage)
  ]);

  return {
    wishlistItems: results,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalItems: totalCount,
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1
    }
  };
};

// Node.js Concept: Instance methods for document operations
wishlistSchema.methods.updatePriority = async function (newPriority: 'low' | 'medium' | 'high') {
  this.priority = newPriority;
  return await this.save();
};

wishlistSchema.methods.addTags = async function (newTags: string[]) {
  // Remove duplicates and add new tags
  const currentTags = new Set(this.tags);
  newTags.forEach(tag => currentTags.add(tag.toLowerCase().trim()));
  this.tags = Array.from(currentTags);
  return await this.save();
};

wishlistSchema.methods.removeTags = async function (tagsToRemove: string[]) {
  this.tags = this.tags.filter((tag: string) =>
    !tagsToRemove.map((t: string) => t.toLowerCase().trim()).includes(tag)
  );
  return await this.save();
};

// Define model interface with static methods
interface IWishlistModel extends Model<WishlistDocument> {
  getUserWishlistWithTrips(
    userId: Types.ObjectId,
    options?: {
      priority?: string;
      tags?: string[];
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      page?: number;
      limit?: number;
    }
  ): Promise<{
    wishlistItems: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }>;
}

// Export with proper typing to avoid complex union types
export const Wishlist = (mongoose.models.Wishlist || mongoose.model<WishlistDocument, IWishlistModel>('Wishlist', wishlistSchema)) as IWishlistModel;

export default Wishlist;
