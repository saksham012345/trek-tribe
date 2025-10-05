import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [longitude, latitude]
  landmark?: string;
  contactPerson?: string;
  contactPhone?: string;
  estimatedTime?: string; // e.g., "6:00 AM"
  isActive: boolean;
}

export interface ParticipantInfo {
  userId: Types.ObjectId;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  specialRequests?: string;
  selectedPickupPoint?: string; // pickup point ID
  joinedAt: Date;
}

export interface TripDocument extends Document {
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  categories: string[];
  destination: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  pickupPoints: PickupPoint[];
  schedule: { day: number; title: string; activities: string[] }[];
  images: string[];
  coverImage?: string;
  itinerary?: string;
  itineraryPdf?: string;
  capacity: number;
  price: number;
  startDate: Date;
  endDate: Date;
  participants: Types.ObjectId[];
  participantDetails: ParticipantInfo[];
  status: 'active' | 'cancelled' | 'completed';
  // Additional fields
  difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
  includedItems: string[];
  excludedItems: string[];
  requirements: string[];
  cancellationPolicy: string;
  // Payment options
  paymentOptions: {
    allowAdvancePayment: boolean;
    advanceAmount?: number;
    advancePercentage?: number;
    fullPaymentRequired?: boolean;
    refundPolicy: string;
  };
  // Ratings and reviews
  averageRating?: number;
  totalRatings: number;
  ratingBreakdown?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  // Wishlist count
  wishlistCount: number;
  // Trip statistics
  viewCount: number;
  bookingCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const pickupPointSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: {
    type: [Number], // [longitude, latitude]
    required: true,
    validate: {
      validator: function(coords: number[]) {
        return coords.length === 2;
      },
      message: 'Coordinates must be [longitude, latitude]'
    }
  },
  landmark: { type: String },
  contactPerson: { type: String },
  contactPhone: { type: String },
  estimatedTime: { type: String },
  isActive: { type: Boolean, default: true }
});

const participantInfoSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emergencyContactName: { type: String, required: true },
  emergencyContactPhone: { type: String, required: true },
  medicalConditions: String,
  dietaryRestrictions: String,
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  specialRequests: String,
  selectedPickupPoint: { type: String }, // pickup point ID
  joinedAt: { type: Date, default: Date.now }
});

// Define schema without explicit generic type to avoid union complexity
const tripSchema = new Schema(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    categories: [{ type: String, index: true }],
    destination: { type: String, required: true, index: true },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], index: '2dsphere' },
    },
    pickupPoints: [pickupPointSchema],
    schedule: [{ 
      day: { type: Number, required: true }, 
      title: { type: String, required: true }, 
      activities: [{ type: String }] 
    }],
    images: [{ type: String }],
    coverImage: { type: String },
    itinerary: { type: String },
    itineraryPdf: { type: String },
    capacity: { type: Number, required: true },
    price: { type: Number, required: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    participantDetails: [participantInfoSchema],
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
    // Additional fields
    difficultyLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    includedItems: [{ type: String }],
    excludedItems: [{ type: String }],
    requirements: [{ type: String }],
    cancellationPolicy: { type: String, default: 'moderate' },
    // Payment options
    paymentOptions: {
      allowAdvancePayment: { type: Boolean, default: false },
      advanceAmount: { type: Number, min: 0 },
      advancePercentage: { type: Number, min: 0, max: 100 },
      fullPaymentRequired: { type: Boolean, default: false },
      refundPolicy: { type: String, default: 'Refund as per cancellation policy' }
    },
    // Ratings and reviews
    averageRating: { type: Number, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0, min: 0 },
    ratingBreakdown: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    },
    // Trip statistics
    wishlistCount: { type: Number, default: 0, min: 0 },
    viewCount: { type: Number, default: 0, min: 0 },
    bookingCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true }
);

tripSchema.index({ title: 'text', description: 'text', destination: 'text' });

// Export with proper typing to avoid complex union types
export const Trip = (mongoose.models.Trip || mongoose.model('Trip', tripSchema)) as any as Model<TripDocument>;


