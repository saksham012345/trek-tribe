/**
 * Verification Request Model
 * Manages organizer verification requests and admin review process
 */

import mongoose, { Schema, Document } from 'mongoose';

export type VerificationRequestType = 'initial' | 'kyc_update' | 're_verification';
export type VerificationRequestStatus = 'pending' | 'under_review' | 'approved' | 'rejected';
export type DocumentType = 'pan' | 'aadhar' | 'business_proof' | 'bank_statement' | 'gst';

export interface VerificationDocument {
  type: DocumentType;
  url: string;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
}

export interface VerificationRequestDocument extends Document {
  organizerId: mongoose.Types.ObjectId;
  organizerName: string;
  organizerEmail: string;
  requestType: VerificationRequestType;
  status: VerificationRequestStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  documents: VerificationDocument[];
  kycDetails: {
    panNumber?: string;
    businessName?: string;
    phone?: string;
    address?: string;
  };
  adminNotes?: string;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  approvalNotes?: string;
  rejectionReason?: string;
  initialTrustScore?: number;  // Score assigned on approval
  createdAt: Date;
  updatedAt: Date;
}

const verificationDocumentSchema = new Schema({
  type: {
    type: String,
    enum: ['pan', 'aadhar', 'business_proof', 'bank_statement', 'gst'],
    required: true
  },
  url: { type: String, required: true },
  verified: { type: Boolean, default: false },
  verifiedAt: Date,
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  rejectionReason: String
}, { _id: false });

const verificationRequestSchema = new Schema({
  organizerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  organizerName: { type: String, required: true },
  organizerEmail: { type: String, required: true },
  requestType: {
    type: String,
    enum: ['initial', 'kyc_update', 're_verification'],
    default: 'initial'
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  documents: [verificationDocumentSchema],
  kycDetails: {
    panNumber: String,
    businessName: String,
    phone: String,
    address: String
  },
  adminNotes: String,
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  approvalNotes: String,
  rejectionReason: String,
  initialTrustScore: {
    type: Number,
    min: 0,
    max: 100
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
verificationRequestSchema.index({ status: 1, createdAt: -1 });
verificationRequestSchema.index({ organizerId: 1, createdAt: -1 });
verificationRequestSchema.index({ priority: 1, status: 1 });

export const VerificationRequest = mongoose.model<VerificationRequestDocument>(
  'VerificationRequest',
  verificationRequestSchema
);
