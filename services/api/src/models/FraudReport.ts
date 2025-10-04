import mongoose, { Schema, Document, Model } from 'mongoose';

export type FraudType = 'fake_account' | 'fake_trip' | 'payment_fraud' | 'fake_reviews' | 'identity_theft' | 'money_laundering' | 'spam' | 'other';
export type FraudStatus = 'reported' | 'under_investigation' | 'verified' | 'false_positive' | 'resolved' | 'escalated';
export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportSource = 'user_report' | 'system_detection' | 'agent_flagged' | 'automated_scan' | 'external_tip';

export interface FraudReportDocument extends Document {
  reportedEntityType: 'user' | 'trip' | 'review' | 'payment';
  reportedEntityId: mongoose.Types.ObjectId;
  reportedBy?: mongoose.Types.ObjectId; // null if system-generated
  reportSource: ReportSource;
  type: FraudType;
  severity: FraudSeverity;
  status: FraudStatus;
  description: string;
  evidence?: Array<{
    type: 'screenshot' | 'document' | 'log' | 'url' | 'other';
    filename?: string;
    url?: string;
    description: string;
    collectedAt: Date;
  }>;
  systemFlags?: Array<{
    flag: string;
    confidence: number; // 0-1
    triggeredAt: Date;
    details?: any;
  }>;
  investigationNotes?: Array<{
    agentId: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    isInternal: boolean;
  }>;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  investigationStartedAt?: Date;
  resolvedAt?: Date;
  resolution?: {
    type: 'no_action' | 'warning_issued' | 'account_suspended' | 'account_banned' | 'content_removed' | 'legal_action';
    details: string;
    actionTakenBy: mongoose.Types.ObjectId;
    actionTakenAt: Date;
    followUpRequired: boolean;
  };
  relatedReports?: mongoose.Types.ObjectId[];
  financialImpact?: {
    estimatedLoss?: number;
    actualLoss?: number;
    currency?: string;
    affectedUsers?: number;
  };
  legalActions?: Array<{
    type: string;
    description: string;
    filedAt: Date;
    status: string;
    referenceNumber?: string;
  }>;
  escalation?: {
    reason: string;
    escalatedBy: mongoose.Types.ObjectId;
    escalatedAt: Date;
    escalatedTo: string;
  };
  riskScore?: number; // 0-100
  tags?: string[];
  reporterReward?: {
    amount: number;
    currency: string;
    status: 'pending' | 'approved' | 'paid' | 'denied';
    processedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const fraudReportSchema = new Schema({
  reportedEntityType: {
    type: String,
    enum: ['user', 'trip', 'review', 'payment'],
    required: true,
    index: true
  },
  reportedEntityId: { type: Schema.Types.ObjectId, required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  reportSource: {
    type: String,
    enum: ['user_report', 'system_detection', 'agent_flagged', 'automated_scan', 'external_tip'],
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['fake_account', 'fake_trip', 'payment_fraud', 'fake_reviews', 'identity_theft', 'money_laundering', 'spam', 'other'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['reported', 'under_investigation', 'verified', 'false_positive', 'resolved', 'escalated'],
    default: 'reported',
    index: true
  },
  description: { type: String, required: true },
  evidence: [{
    type: { type: String, enum: ['screenshot', 'document', 'log', 'url', 'other'], required: true },
    filename: { type: String },
    url: { type: String },
    description: { type: String, required: true },
    collectedAt: { type: Date, default: Date.now }
  }],
  systemFlags: [{
    flag: { type: String, required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    triggeredAt: { type: Date, default: Date.now },
    details: Schema.Types.Mixed
  }],
  investigationNotes: [{
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: true }
  }],
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date },
  investigationStartedAt: { type: Date },
  resolvedAt: { type: Date },
  resolution: {
    type: { 
      type: String, 
      enum: ['no_action', 'warning_issued', 'account_suspended', 'account_banned', 'content_removed', 'legal_action']
    },
    details: { type: String },
    actionTakenBy: { type: Schema.Types.ObjectId, ref: 'User' },
    actionTakenAt: { type: Date },
    followUpRequired: { type: Boolean, default: false }
  },
  relatedReports: [{ type: Schema.Types.ObjectId, ref: 'FraudReport' }],
  financialImpact: {
    estimatedLoss: { type: Number, min: 0 },
    actualLoss: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    affectedUsers: { type: Number, min: 0 }
  },
  legalActions: [{
    type: { type: String, required: true },
    description: { type: String, required: true },
    filedAt: { type: Date, required: true },
    status: { type: String, required: true },
    referenceNumber: { type: String }
  }],
  escalation: {
    reason: { type: String },
    escalatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    escalatedAt: { type: Date },
    escalatedTo: { type: String }
  },
  riskScore: { type: Number, min: 0, max: 100 },
  tags: [{ type: String }],
  reporterReward: {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['pending', 'approved', 'paid', 'denied'], default: 'pending' },
    processedAt: { type: Date }
  }
}, { timestamps: true });

// Indexes for common queries
fraudReportSchema.index({ status: 1, severity: -1, createdAt: -1 });
fraudReportSchema.index({ assignedAgentId: 1, status: 1 });
fraudReportSchema.index({ type: 1, status: 1 });
fraudReportSchema.index({ reportedEntityType: 1, reportedEntityId: 1 });
fraudReportSchema.index({ reportSource: 1 });
fraudReportSchema.index({ riskScore: -1 });

export const FraudReport = (mongoose.models.FraudReport || mongoose.model('FraudReport', fraudReportSchema)) as Model<FraudReportDocument>;