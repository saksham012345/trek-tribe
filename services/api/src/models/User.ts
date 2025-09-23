import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin';

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
  passwordHash: string;
  name: string;
  role: UserRole;
  preferences?: UserPreferences;
  emergencyContacts?: EmergencyContact[];
  trackingPreferences?: TrackingPreferences;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define schema without explicit generic type to avoid union complexity
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['traveler', 'organizer', 'admin'], 
      default: 'traveler', 
      index: true 
    },
    phone: { type: String, required: false },
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


