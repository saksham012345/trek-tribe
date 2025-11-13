import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'traveler' | 'organizer' | 'admin' | 'agent';

interface UserPreferences {
  categories?: string[];
  budgetRange?: [number, number];
  locations?: string[];
  difficultyLevels?: string[];
  accommodationTypes?: string[];
  tripDurations?: string[];
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    tripUpdates?: boolean;
    promotions?: boolean;
  };
}

interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
  website?: string;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
}

interface TravelStats {
  tripsCompleted: number;
  totalDistance: number;
  favoriteDestinations: string[];
  badges: string[];
  reviewCount: number;
  averageRating: number;
}

interface AutoPayInfo {
  isSetupRequired: boolean;
  isSetupCompleted: boolean;
  firstLoginDate?: Date;
  setupCompletedDate?: Date;
  scheduledPaymentDate?: Date;
  paymentAmount?: number;
  razorpayCustomerId?: string;
  paymentMethodId?: string;
  lastPaymentDate?: Date;
  nextPaymentDate?: Date;
  autoPayEnabled: boolean;
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
  uniqueUrl?: string;
  businessInfo?: {
    companyName?: string;
    licenseNumber?: string;
    insuranceDetails?: string;
  };
  paymentQR?: string;
  qrCodes?: Array<{
    filename: string;
    originalName: string;
    path: string;
    paymentMethod: string;
    description: string;
    uploadedAt: Date;
    isActive: boolean;
    _id?: any;
  }>;
  autoPay?: AutoPayInfo;
}

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  phone?: string;
  bio?: string;
  profilePhoto?: string;
  coverPhoto?: string;
  location?: string;
  dateOfBirth?: Date;
  gender?: string;
  occupation?: string;
  uniqueUrl?: string;
  emergencyContact?: EmergencyContact;
  travelStats?: TravelStats;
  preferences?: UserPreferences;
  socialLinks?: SocialLinks;
  organizerProfile?: OrganizerProfile;
  socialStats?: {
    followersCount: number;
    followingCount: number;
    postsCount: number;
  };
  isVerified?: boolean;
  emailVerified?: boolean;
  emailVerificationOtp?: string;
  emailVerificationOtpHash?: string;
  emailVerificationExpiry?: Date;
  emailVerificationExpires?: Date;
  emailVerificationAttempts?: number;
  emailVerificationLastSentAt?: Date;
  phoneVerified?: boolean;
  phoneVerificationOtpHash?: string;
  phoneVerificationExpires?: Date;
  phoneVerificationAttempts?: number;
  phoneVerificationLastSentAt?: Date;
  verificationDocuments?: Array<{
    filename: string;
    originalName: string;
    path: string;
    size: number;
    mimetype: string;
    uploadedAt: Date;
    verified: boolean;
  }>;
  privacySettings?: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
    showPhone: boolean;
    showLocation: boolean;
  };
  lastActive?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  firstOrganizerLogin?: Date;
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
    coverPhoto: { type: String },
    location: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
    occupation: { type: String },
    uniqueUrl: { type: String, unique: true, sparse: true },
    emergencyContact: {
      type: {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String }
      },
      required: false
    },
    travelStats: {
      type: {
        tripsCompleted: { type: Number, default: 0 },
        totalDistance: { type: Number, default: 0 },
        favoriteDestinations: [{ type: String }],
        badges: [{ type: String }],
        reviewCount: { type: Number, default: 0 },
        averageRating: { type: Number, default: 0, min: 0, max: 5 }
      },
      required: false
    },
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
        locations: [{ type: String }],
        difficultyLevels: [{ type: String, enum: ['beginner', 'intermediate', 'advanced'] }],
        accommodationTypes: [{ type: String }],
        tripDurations: [{ type: String }],
        notifications: {
          type: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            push: { type: Boolean, default: true },
            tripUpdates: { type: Boolean, default: true },
            promotions: { type: Boolean, default: false }
          },
          required: false
        }
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
        achievements: [{ type: String }],
        uniqueUrl: { type: String, unique: true, sparse: true },
        businessInfo: {
          type: {
            companyName: { type: String },
            licenseNumber: { type: String },
            insuranceDetails: { type: String }
          },
          required: false
        },
        paymentQR: { type: String },
        qrCodes: [{
          filename: { type: String, required: true },
          originalName: { type: String, required: true },
          path: { type: String, required: true },
          paymentMethod: { type: String, default: 'UPI' },
          description: { type: String, default: '' },
          uploadedAt: { type: Date, default: Date.now },
          isActive: { type: Boolean, default: true }
        }],
        autoPay: {
          type: {
            isSetupRequired: { type: Boolean, default: true },
            isSetupCompleted: { type: Boolean, default: false },
            firstLoginDate: { type: Date },
            setupCompletedDate: { type: Date },
            scheduledPaymentDate: { type: Date },
            paymentAmount: { type: Number },
            razorpayCustomerId: { type: String },
            paymentMethodId: { type: String },
            lastPaymentDate: { type: Date },
            nextPaymentDate: { type: Date },
            autoPayEnabled: { type: Boolean, default: false }
          },
          required: false
        }
      },
      required: false
    },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailVerificationOtp: { type: String },
    emailVerificationOtpHash: { type: String },
    emailVerificationExpiry: { type: Date },
    emailVerificationExpires: { type: Date },
    emailVerificationAttempts: { type: Number, default: 0 },
    emailVerificationLastSentAt: { type: Date },
    phoneVerified: { type: Boolean, default: false },
    phoneVerificationOtpHash: { type: String },
    phoneVerificationExpires: { type: Date },
    phoneVerificationAttempts: { type: Number, default: 0 },
    phoneVerificationLastSentAt: { type: Date },
    verificationDocuments: [{
      filename: { type: String, required: true },
      originalName: { type: String, required: true },
      path: { type: String, required: true },
      size: { type: Number, required: true },
      mimetype: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      verified: { type: Boolean, default: false }
    }],
    privacySettings: {
      type: {
        profileVisibility: { type: String, enum: ['public', 'private', 'friends'], default: 'public' },
        showEmail: { type: Boolean, default: false },
        showPhone: { type: Boolean, default: false },
        showLocation: { type: Boolean, default: true }
      },
      required: false
    },
    socialStats: {
      type: {
        followersCount: { type: Number, default: 0, min: 0 },
        followingCount: { type: Number, default: 0, min: 0 },
        postsCount: { type: Number, default: 0, min: 0 }
      },
      required: false
    },
    lastActive: { type: Date, default: Date.now },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    firstOrganizerLogin: { type: Date }
  },
  { timestamps: true }
);

userSchema.index({ name: 'text', email: 'text' });

// Pre-save middleware to ensure socialStats are initialized
userSchema.pre('save', function(next) {
  if (!this.socialStats) {
    this.socialStats = {
      followersCount: 0,
      followingCount: 0,
      postsCount: 0
    };
  }
  next();
});

// Export with proper typing to avoid complex union types
export const User = (mongoose.models.User || mongoose.model('User', userSchema)) as any as Model<UserDocument>;


