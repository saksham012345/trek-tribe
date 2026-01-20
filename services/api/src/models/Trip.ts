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
  dueDate?: Date; // When full payment is due
  refundPolicy?: string;
  paymentMethods: string[]; // e.g., ['upi', 'card', 'netbanking']
  instructions?: string;
  collectionMode?: 'razorpay' | 'manual'; // Organizer chooses gateway vs manual screenshots
  verificationMode?: 'automated' | 'manual'; // Automated via gateway vs manual review
  manualProofRequired?: boolean; // Whether traveler must upload payment screenshot
  trustLevel?: 'trusted' | 'manual'; // Display hint for users about trust
  gatewayQR?: {
    provider: 'razorpay';
    amount: number;
    currency: string;
    referenceId: string;
    qrCodeUrl: string;
    generatedAt: Date;
    trusted: boolean;
  };
}

// Live trip photos uploaded during trip by organizer
export interface LiveTripPhoto {
  url: string;
  filename: string;
  uploadedAt: Date;
  caption?: string;
  location?: string;
  isThumbnail: boolean; // First uploaded photo is thumbnail
}

// Safety and trust features
export interface SafetyInfo {
  hasInsurance: boolean;
  insuranceDetails?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  medicalFacilitiesNearby?: string;
  safetyEquipment?: string[];
  covidProtocol?: string;
}

export interface TripDocument extends Document {
  organizerId: Types.ObjectId;
  title: string;
  description: string;
  difficulty?: string;
  categories: string[];
  destination: string;
  location?: { type: 'Point'; coordinates: [number, number] };
  schedule: { day: number; title: string; activities: string[] }[];
  images: string[];
  coverImage?: string;
  itinerary?: string;
  itineraryPdf?: string; // PDF URL - New: secure PDF upload
  itineraryPdfFilename?: string; // Original filename
  itineraryPdfUploadedAt?: Date;
  capacity: number;
  price: number;
  minimumAge?: number; // Minimum age requirement for travelers
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
  // NEW: Live trip photos (mandatory - minimum 1 required)
  livePhotos: LiveTripPhoto[];
  thumbnail?: string; // Auto-set from first live photo
  // NEW: Verification and approval
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedBy?: Types.ObjectId; // Admin who verified
  verifiedAt?: Date;
  rejectionReason?: string;
  adminNotes?: string;
  // NEW: Safety and trust
  safetyInfo?: SafetyInfo;
  safetyDisclaimer: string; // Mandatory safety disclaimer
  // NEW: Duplicate detection
  contentHash?: string; // Hash for duplicate detection
  isDuplicate: boolean;
  originalTripId?: Types.ObjectId; // Reference to original if duplicate
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
  dueDate: { type: Date },
  refundPolicy: { type: String },
  paymentMethods: { type: [String], default: ['upi'] },
  instructions: { type: String },
  collectionMode: { type: String, enum: ['razorpay', 'manual'], default: 'razorpay' },
  verificationMode: { type: String, enum: ['automated', 'manual'], default: 'automated' },
  manualProofRequired: { type: Boolean, default: false },
  trustLevel: { type: String, enum: ['trusted', 'manual'], default: 'trusted' },
  gatewayQR: {
    provider: { type: String, enum: ['razorpay'] },
    amount: { type: Number },
    currency: { type: String },
    referenceId: { type: String },
    qrCodeUrl: { type: String },
    generatedAt: { type: Date },
    trusted: { type: Boolean, default: true }
  }
}, { _id: false });

const livePhotoSchema = new Schema({
  url: { type: String, required: true },
  filename: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  caption: { type: String, maxlength: 200 },
  location: { type: String },
  isThumbnail: { type: Boolean, default: false }
}, { _id: false });

const safetyInfoSchema = new Schema({
  hasInsurance: { type: Boolean, default: false },
  insuranceDetails: { type: String },
  emergencyContactName: { type: String },
  emergencyContactPhone: { type: String },
  medicalFacilitiesNearby: { type: String },
  safetyEquipment: [{ type: String }],
  covidProtocol: { type: String }
}, { _id: false });

// Define schema without explicit generic type to avoid union complexity
const tripSchema = new Schema(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, index: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'moderate', 'hard'], default: 'moderate', index: true },
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
    itineraryPdfFilename: { type: String },
    itineraryPdfUploadedAt: { type: Date },
    capacity: { type: Number, required: true },
    price: { type: Number, required: true },
    minimumAge: { type: Number, min: 1, max: 100 }, // Optional minimum age requirement
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
    // Trip lifecycle status. New trips created by organizers remain in 'pending'
    // until explicitly approved by an admin. Approved trips move to 'active'.
    status: { type: String, enum: ['pending', 'active', 'cancelled', 'completed'], default: 'pending' },
    // Review and rating fields
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    // Live trip photos (mandatory)
    livePhotos: {
      type: [livePhotoSchema],
      default: [],
      validate: {
        validator: function (photos: any[]) {
          // Only validate if trip has started (past startDate)
          const trip = this as any;
          if (trip.startDate && new Date() > new Date(trip.startDate)) {
            return photos && photos.length > 0;
          }
          return true; // No validation before trip starts
        },
        message: 'At least one live photo is required after trip starts'
      }
    },
    thumbnail: { type: String },
    // Verification and approval
    verificationStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    adminNotes: { type: String, maxlength: 1000 },
    // Safety and trust
    safetyInfo: { type: safetyInfoSchema },
    safetyDisclaimer: {
      type: String,
      required: true,
      default: 'This trip involves physical activity and potential risks. Participants must be in good health and follow safety guidelines. The organizer is not liable for accidents, injuries, or loss of belongings. Travel insurance is recommended.'
    },
    // Duplicate detection
    contentHash: { type: String, index: true },
    isDuplicate: { type: Boolean, default: false, index: true },
    originalTripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  },
  { timestamps: true }
);

tripSchema.index({ title: 'text', description: 'text', destination: 'text' });

// Export with proper typing to avoid complex union types
export const Trip = (mongoose.models.Trip || mongoose.model<TripDocument>('Trip', tripSchema)) as Model<TripDocument>;


