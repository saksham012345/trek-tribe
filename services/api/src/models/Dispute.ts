import mongoose, { Schema, Document, Model } from 'mongoose';

export type DisputeType = 'refund' | 'trip_cancellation' | 'service_quality' | 'payment_issue' | 'booking_error' | 'other';
export type DisputeStatus = 'pending' | 'under_review' | 'investigating' | 'resolved' | 'rejected' | 'escalated';
export type DisputePriority = 'low' | 'medium' | 'high' | 'urgent';

export interface DisputeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId;
  organizerId?: mongoose.Types.ObjectId;
  type: DisputeType;
  status: DisputeStatus;
  priority: DisputePriority;
  subject: string;
  description: string;
  requestedAmount?: number;
  currency?: string;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  evidence?: Array<{
    type: 'image' | 'document' | 'receipt' | 'screenshot';
    filename: string;
    url: string;
    description?: string;
    uploadedAt: Date;
  }>;
  timeline?: Array<{
    date: Date;
    description: string;
    evidence?: string;
  }>;
  agentNotes?: Array<{
    agentId: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    isInternal: boolean;
  }>;
  communications?: Array<{
    from: 'user' | 'agent' | 'organizer';
    message: string;
    createdAt: Date;
    readAt?: Date;
  }>;
  resolution?: {
    type: 'full_refund' | 'partial_refund' | 'credit' | 'no_action' | 'compromise';
    amount?: number;
    currency?: string;
    details: string;
    approvedBy: mongoose.Types.ObjectId;
    approvedAt: Date;
    processedAt?: Date;
    refundTransactionId?: string;
  };
  organizerResponse?: {
    message: string;
    supportingEvidence?: Array<{
      filename: string;
      url: string;
      description?: string;
    }>;
    respondedAt: Date;
  };
  escalation?: {
    reason: string;
    escalatedBy: mongoose.Types.ObjectId;
    escalatedAt: Date;
    escalatedTo?: string; // Higher authority or external mediator
  };
  userSatisfactionRating?: number;
  userFeedback?: string;
  tags?: string[];
  relatedDisputes?: mongoose.Types.ObjectId[];
  financialImpact?: {
    companyLoss?: number;
    organizerDeduction?: number;
    processingFee?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const disputeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true },
  organizerId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  type: {
    type: String,
    enum: ['refund', 'trip_cancellation', 'service_quality', 'payment_issue', 'booking_error', 'other'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'investigating', 'resolved', 'rejected', 'escalated'],
    default: 'pending',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  requestedAmount: { type: Number, min: 0 },
  currency: { type: String, default: 'INR' },
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date },
  evidence: [{
    type: { type: String, enum: ['image', 'document', 'receipt', 'screenshot'], required: true },
    filename: { type: String, required: true },
    url: { type: String, required: true },
    description: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  timeline: [{
    date: { type: Date, required: true },
    description: { type: String, required: true },
    evidence: { type: String }
  }],
  agentNotes: [{
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: true }
  }],
  communications: [{
    from: { type: String, enum: ['user', 'agent', 'organizer'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date }
  }],
  resolution: {
    type: { type: String, enum: ['full_refund', 'partial_refund', 'credit', 'no_action', 'compromise'] },
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    details: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    processedAt: { type: Date },
    refundTransactionId: { type: String }
  },
  organizerResponse: {
    message: { type: String },
    supportingEvidence: [{
      filename: { type: String },
      url: { type: String },
      description: { type: String }
    }],
    respondedAt: { type: Date }
  },
  escalation: {
    reason: { type: String },
    escalatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    escalatedAt: { type: Date },
    escalatedTo: { type: String }
  },
  userSatisfactionRating: { type: Number, min: 1, max: 5 },
  userFeedback: { type: String },
  tags: [{ type: String }],
  relatedDisputes: [{ type: Schema.Types.ObjectId, ref: 'Dispute' }],
  financialImpact: {
    companyLoss: { type: Number, default: 0 },
    organizerDeduction: { type: Number, default: 0 },
    processingFee: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Indexes for common queries
disputeSchema.index({ status: 1, priority: -1, createdAt: -1 });
disputeSchema.index({ assignedAgentId: 1, status: 1 });
disputeSchema.index({ type: 1, status: 1 });
disputeSchema.index({ userId: 1, createdAt: -1 });
disputeSchema.index({ tripId: 1 });
disputeSchema.index({ organizerId: 1 });

export const Dispute = (mongoose.models.Dispute || mongoose.model('Dispute', disputeSchema)) as Model<DisputeDocument>;