import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin' | 'agent';

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary?: boolean;
}

interface UserPreferences {
  categories?: string[];
  budgetRange?: [number, number];
  locations?: string[];
}

interface TrackingPreferences {
  shareLocationWithEmergencyContacts?: boolean;
  allowLocationTracking?: boolean;
  notificationFrequency?: 'hourly' | 'every4hours' | 'daily';
}

export interface UserDocument extends Document {
  email: string;
  passwordHash?: string; // Optional for OAuth users
  name: string;
  role: UserRole;
  preferences?: UserPreferences;
  emergencyContacts?: EmergencyContact[];
  trackingPreferences?: TrackingPreferences;
  phone?: string;
  // OAuth and verification fields
  googleId?: string;
  profilePicture?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  // Ratings and reviews
  averageRating?: number;
  totalRatings: number;
  totalTripsOrganized: number;
  totalTripsJoined: number;
  // Notification preferences
  notificationPreferences?: {
    email: boolean;
    push: boolean;
    sms: boolean;
    marketing: boolean;
  };
  // Referral code
  referralCode?: string;
  referralStats?: {
    totalReferred: number;
    successfulReferrals: number;
    totalRewardsClaimed: number;
  };
  // Account status
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Define schema without explicit generic type to avoid union complexity
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: false }, // Optional for OAuth users
    name: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['traveler', 'organizer', 'admin', 'agent'], 
      default: 'traveler', 
      index: true 
    },
    phone: { type: String, required: false },
    // OAuth and verification fields
    googleId: { type: String, unique: true, sparse: true, index: true },
    profilePicture: { type: String },
    emailVerified: { type: Boolean, default: false, index: true },
    phoneVerified: { type: Boolean, default: false, index: true },
    // Ratings and reviews
    averageRating: { type: Number, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0, min: 0 },
    totalTripsOrganized: { type: Number, default: 0, min: 0 },
    totalTripsJoined: { type: Number, default: 0, min: 0 },
    // Notification preferences
    notificationPreferences: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      marketing: { type: Boolean, default: true }
    },
    // Referral code
    referralCode: { 
      type: String, 
      unique: true, 
      sparse: true,
      uppercase: true,
      default: () => 'USER' + Math.random().toString(36).substr(2, 6).toUpperCase()
    },
    referralStats: {
      totalReferred: { type: Number, default: 0 },
      successfulReferrals: { type: Number, default: 0 },
      totalRewardsClaimed: { type: Number, default: 0 }
    },
    // Account status
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date },
    preferences: {
      type: {
        categories: [{ type: String }],
        budgetRange: { 
          type: [Number], 
          validate: {
            validator: function(v: number[]) {
              return !v || v.length === 0 || v.length === 2;
            },
            message: 'Budget range must have exactly 2 numbers or be empty'
          }
        },
        locations: [{ type: String }]
      },
      required: false
    },
    emergencyContacts: [{
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: false },
      isPrimary: { type: Boolean, default: false }
    }],
    trackingPreferences: {
      shareLocationWithEmergencyContacts: { type: Boolean, default: true },
      allowLocationTracking: { type: Boolean, default: true },
      notificationFrequency: { 
        type: String, 
        enum: ['hourly', 'every4hours', 'daily'], 
        default: 'every4hours'
      }
    }
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

// Export with proper typing to avoid complex union types
export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as any as Model<UserDocument>;


