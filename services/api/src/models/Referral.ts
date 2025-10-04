import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ReferralDocument extends Document {
  referrerId: Types.ObjectId;
  refereeId?: Types.ObjectId; // Set when referee signs up
  referralCode: string;
  email?: string; // Referee's email if not yet signed up
  phone?: string; // Referee's phone if not yet signed up
  status: 'pending' | 'completed' | 'expired';
  rewardType: 'discount' | 'credits' | 'cashback';
  rewardAmount: number;
  rewardCurrency: string;
  rewardDescription: string;
  referrerRewardClaimed: boolean;
  refereeRewardClaimed: boolean;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const referralSchema = new Schema(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refereeId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    referralCode: { 
      type: String, 
      required: true, 
      unique: true,
      uppercase: true,
      default: () => 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase()
    },
    email: { type: String, lowercase: true },
    phone: { type: String },
    status: { 
      type: String, 
      enum: ['pending', 'completed', 'expired'], 
      default: 'pending',
      index: true 
    },
    rewardType: { 
      type: String, 
      enum: ['discount', 'credits', 'cashback'], 
      default: 'discount' 
    },
    rewardAmount: { type: Number, required: true, min: 0 },
    rewardCurrency: { type: String, default: 'INR' },
    rewardDescription: { type: String, required: true },
    referrerRewardClaimed: { type: Boolean, default: false },
    refereeRewardClaimed: { type: Boolean, default: false },
    completedAt: { type: Date },
    expiresAt: { 
      type: Date, 
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
referralSchema.index({ referralCode: 1 }, { unique: true });
referralSchema.index({ email: 1, referrerId: 1 });
referralSchema.index({ status: 1, expiresAt: 1 });
referralSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export const Referral = (mongoose.models.Referral || mongoose.model('Referral', referralSchema)) as any as Model<ReferralDocument>;