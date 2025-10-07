import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin' | 'agent';

interface UserPreferences {
  categories?: string[];
  budgetRange?: [number, number];
  locations?: string[];
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

interface OrganizerProfile {
  bio?: string;
  experience?: string;
  specialties?: string[];
  certifications?: string[];
  languages?: string[];
  yearsOfExperience?: number;
  totalTripsOrganized?: number;
  achievements?: string[];
}

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone?: string;
  bio?: string;
  profilePhoto?: string;
  location?: string;
  dateOfBirth?: Date;
  preferences?: UserPreferences;
  socialLinks?: SocialLinks;
  organizerProfile?: OrganizerProfile;
  isVerified?: boolean;
  lastActive?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
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
      enum: ['traveler', 'organizer', 'admin', 'agent'], 
      default: 'traveler', 
      index: true 
    },
    phone: { type: String },
    bio: { type: String, maxlength: 500 },
    profilePhoto: { type: String },
    location: { type: String },
    dateOfBirth: { type: Date },
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
    socialLinks: {
      type: {
        instagram: { type: String },
        facebook: { type: String },
        twitter: { type: String },
        linkedin: { type: String },
        website: { type: String }
      },
      required: false
    },
    organizerProfile: {
      type: {
        bio: { type: String, maxlength: 1000 },
        experience: { type: String, maxlength: 1000 },
        specialties: [{ type: String }],
        certifications: [{ type: String }],
        languages: [{ type: String }],
        yearsOfExperience: { type: Number, min: 0 },
        totalTripsOrganized: { type: Number, default: 0, min: 0 },
        achievements: [{ type: String }]
      },
      required: false
    },
    isVerified: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

// Export with proper typing to avoid complex union types
export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as any as Model<UserDocument>;


