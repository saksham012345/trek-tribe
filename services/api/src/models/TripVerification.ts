import mongoose, { Schema, Document } from 'mongoose';

export interface ITripVerification extends Document {
  tripId: mongoose.Types.ObjectId;
  organizerId: mongoose.Types.ObjectId;
  status: 'pending' | 'under_review' | 'verified' | 'rejected' | 'revision_required';
  submittedAt: Date;
  documents: {
    type: 'license' | 'insurance' | 'permits' | 'id_proof' | 'business_registration' | 'other';
    filename: string;
    url: string;
    uploadedAt: Date;
    verified?: boolean;
  }[];
  verificationChecklist: {
    itemName: string;
    status: 'pending' | 'approved' | 'rejected';
    notes?: string;
    checkedBy?: mongoose.Types.ObjectId;
    checkedAt?: Date;
  }[];
  reviewHistory: {
    reviewedBy: mongoose.Types.ObjectId;
    action: 'submitted' | 'under_review' | 'verified' | 'rejected' | 'revision_requested';
    reason?: string;
    notes?: string;
    timestamp: Date;
  }[];
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  rejectionReason?: string;
  revisionNotes?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

const TripVerificationSchema: Schema = new Schema(
  {
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['pending', 'under_review', 'verified', 'rejected', 'revision_required'],
      default: 'pending',
    },
    submittedAt: { type: Date, default: Date.now },
    documents: [
      {
        type: {
          type: String,
          enum: ['license', 'insurance', 'permits', 'id_proof', 'business_registration', 'other'],
          required: true,
        },
        filename: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],
    verificationChecklist: [
      {
        itemName: { type: String, required: true },
        status: {
          type: String,
          enum: ['pending', 'approved', 'rejected'],
          default: 'pending',
        },
        notes: { type: String },
        checkedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        checkedAt: { type: Date },
      },
    ],
    reviewHistory: [
      {
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        action: {
          type: String,
          enum: ['submitted', 'under_review', 'verified', 'rejected', 'revision_requested'],
          required: true,
        },
        reason: { type: String },
        notes: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: { type: Date },
    rejectionReason: { type: String },
    revisionNotes: { type: String },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TripVerificationSchema.index({ tripId: 1 });
TripVerificationSchema.index({ organizerId: 1 });
TripVerificationSchema.index({ status: 1 });
TripVerificationSchema.index({ submittedAt: -1 });

export default mongoose.model<ITripVerification>('TripVerification', TripVerificationSchema);
