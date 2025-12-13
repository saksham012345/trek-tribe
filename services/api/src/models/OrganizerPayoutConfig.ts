import mongoose, { Schema, Document, Types } from 'mongoose';

export type OnboardingStatus = 'pending' | 'connected' | 'activated' | 'rejected';

export interface OrganizerPayoutConfigDocument extends Document {
  organizerId: Types.ObjectId;
  razorpayAccountId?: string;
  onboardingStatus: OnboardingStatus;
  bankDetails: {
    accountNumberEncrypted: string;
    ifscCode: string;
    accountHolderName: string;
    bankName?: string;
  };
  kycStatus?: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  commissionRate: number; // percentage
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema({
  accountNumberEncrypted: { type: String, required: true },
  ifscCode: { type: String, required: true },
  accountHolderName: { type: String, required: true },
  bankName: { type: String },
}, { _id: false });

const organizerPayoutConfigSchema = new Schema(
  {
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    razorpayAccountId: { type: String },
    onboardingStatus: { type: String, enum: ['pending', 'connected', 'activated', 'rejected'], default: 'pending' },
    bankDetails: { type: bankDetailsSchema, required: true },
    kycStatus: { type: String, enum: ['pending', 'submitted', 'under_review', 'approved', 'rejected'], default: 'pending' },
    commissionRate: { type: Number, default: 5, min: 0, max: 100 },
  },
  { timestamps: true }
);

export const OrganizerPayoutConfig = mongoose.model<OrganizerPayoutConfigDocument>('OrganizerPayoutConfig', organizerPayoutConfigSchema);
