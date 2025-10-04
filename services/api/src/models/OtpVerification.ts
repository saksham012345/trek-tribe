import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface OtpVerificationDocument extends Document {
  userId?: Types.ObjectId; // Optional for signup verification
  email?: string;
  phone?: string;
  otp: string;
  type: 'signup' | 'login' | 'password_reset' | 'phone_verification' | 'email_verification';
  purpose: 'registration' | 'authentication' | 'password_reset' | 'profile_update';
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    email: { type: String, lowercase: true },
    phone: { type: String },
    otp: { type: String, required: true, length: 6 },
    type: { 
      type: String, 
      enum: ['signup', 'login', 'password_reset', 'phone_verification', 'email_verification'], 
      required: true,
      index: true
    },
    purpose: { 
      type: String, 
      enum: ['registration', 'authentication', 'password_reset', 'profile_update'], 
      required: true 
    },
    verified: { type: Boolean, default: false, index: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    expiresAt: { 
      type: Date, 
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
      index: true
    },
    verifiedAt: { type: Date }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
otpVerificationSchema.index({ email: 1, type: 1, verified: 1 });
otpVerificationSchema.index({ phone: 1, type: 1, verified: 1 });
otpVerificationSchema.index({ userId: 1, type: 1, verified: 1 });
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save hook to generate OTP
otpVerificationSchema.pre('save', function(next) {
  if (this.isNew || this.isModified('otp')) {
    // Generate 6-digit OTP
    this.otp = Math.floor(100000 + Math.random() * 900000).toString();
  }
  next();
});

export const OtpVerification = (mongoose.models.OtpVerification || mongoose.model('OtpVerification', otpVerificationSchema)) as any as Model<OtpVerificationDocument>;