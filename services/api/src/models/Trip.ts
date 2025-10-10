import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ParticipantInfo {
  userId: Types.ObjectId;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  specialRequests?: string;
  joinedAt: Date;
}

export interface PickupDropPoint {
  name: string;
  address: string;
  coordinates?: [number, number];
  time?: string;
  contactPerson?: string;
  contactPhone?: string;
  landmarks?: string;
  instructions?: string;
}

// Package variant interface for different booking options
export interface PackageOption {
  id: string;
  name: string; // e.g., "Onwards Price", "2-bed", "3-bed", "Standard", "Premium"
  description?: string;
  price: number;
  capacity: number; // Available spots for this package
  inclusions?: string[]; // What's included in this package
  exclusions?: string[];
  isActive: boolean;
  sortOrder?: number;
}

// Payment configuration for organizers
export interface PaymentConfig {
  paymentType: 'full' | 'advance'; // Full payment or advance payment
  advanceAmount?: number; // If advance payment, amount required
  advancePercentage?: number; // If percentage-based advance
  dueDate?: Date; // When full payment is due
  refundPolicy?: string;
  paymentMethods: string[]; // e.g., ['upi', 'card', 'netbanking']
  instructions?: string;
}

export interface TripDocument extends Document {
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  categories: string[];
  destination: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  schedule: { day: number; title: string; activities: string[] }[];
  images: string[];
  coverImage?: string;
  itinerary?: string;
  itineraryPdf?: string;
  capacity: number;
  price: number;
  // Package options for different variants
  packages: PackageOption[];
  // Payment configuration
  paymentConfig: PaymentConfig;
  startDate: Date;
  endDate: Date;
  pickupPoints: PickupDropPoint[];
  dropOffPoints: PickupDropPoint[];
  participants: Types.ObjectId[];
  participantDetails: ParticipantInfo[];
  status: 'active' | 'cancelled' | 'completed';
  // Review and rating fields
  averageRating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const participantInfoSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  emergencyContactName: { type: String, required: true },
  emergencyContactPhone: { type: String, required: true },
  medicalConditions: String,
  dietaryRestrictions: String,
  experienceLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  specialRequests: String,
  joinedAt: { type: Date, default: Date.now }
});

const pickupDropPointSchema = new Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  coordinates: { type: [Number] },
  time: { type: String },
  contactPerson: { type: String },
  contactPhone: { type: String },
  landmarks: { type: String },
  instructions: { type: String }
});

const packageOptionSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  inclusions: [{ type: String }],
  exclusions: [{ type: String }],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { _id: false });

const paymentConfigSchema = new Schema({
  paymentType: { type: String, enum: ['full', 'advance'], default: 'full' },
  advanceAmount: { type: Number, min: 0 },
  advancePercentage: { type: Number, min: 0, max: 100 },
  dueDate: { type: Date },
  refundPolicy: { type: String },
  paymentMethods: [{ type: String, default: ['upi'] }],
  instructions: { type: String }
}, { _id: false });

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
    // Package options for different variants
    packages: { type: [packageOptionSchema], default: [] },
    // Payment configuration
    paymentConfig: { type: paymentConfigSchema, default: () => ({ paymentType: 'full', paymentMethods: ['upi'] }) },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    pickupPoints: { type: [pickupDropPointSchema], default: [] },
    dropOffPoints: { type: [pickupDropPointSchema], default: [] },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    participantDetails: [participantInfoSchema],
    status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
    // Review and rating fields
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

tripSchema.index({ title: 'text', description: 'text', destination: 'text' });

// Export with proper typing to avoid complex union types
export const Trip = (mongoose.models.Trip || mongoose.model('Trip', tripSchema)) as any as Model<TripDocument>;


