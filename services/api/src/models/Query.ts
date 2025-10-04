import mongoose, { Schema, Document, Model } from 'mongoose';

export type QueryStatus = 'pending' | 'assigned' | 'in_progress' | 'resolved' | 'escalated';
export type QueryPriority = 'low' | 'medium' | 'high' | 'urgent';
export type QueryCategory = 'booking' | 'payment' | 'trip_info' | 'account' | 'technical' | 'refund' | 'complaint' | 'other';

export interface QueryDocument extends Document {
  userId: mongoose.Types.ObjectId;
  chatbotConversationId?: string;
  subject: string;
  description: string;
  category: QueryCategory;
  priority: QueryPriority;
  status: QueryStatus;
  assignedAgentId?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  escalatedAt?: Date;
  escalatedReason?: string;
  tags?: string[];
  attachments?: Array<{
    filename: string;
    url: string;
    uploadedAt: Date;
  }>;
  agentNotes?: Array<{
    agentId: mongoose.Types.ObjectId;
    note: string;
    createdAt: Date;
    isInternal: boolean;
  }>;
  responses?: Array<{
    from: 'user' | 'agent';
    message: string;
    createdAt: Date;
    readAt?: Date;
  }>;
  userSatisfactionRating?: number;
  userFeedback?: string;
  relatedTripId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const querySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  chatbotConversationId: { type: String, index: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['booking', 'payment', 'trip_info', 'account', 'technical', 'refund', 'complaint', 'other'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'resolved', 'escalated'],
    default: 'pending',
    index: true
  },
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  assignedAt: { type: Date },
  firstResponseAt: { type: Date },
  resolvedAt: { type: Date },
  escalatedAt: { type: Date },
  escalatedReason: { type: String },
  tags: [{ type: String }],
  attachments: [{
    filename: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  agentNotes: [{
    agentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: true }
  }],
  responses: [{
    from: { type: String, enum: ['user', 'agent'], required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    readAt: { type: Date }
  }],
  userSatisfactionRating: { type: Number, min: 1, max: 5 },
  userFeedback: { type: String },
  relatedTripId: { type: Schema.Types.ObjectId, ref: 'Trip', index: true }
}, { timestamps: true });

// Compound indexes for common queries
querySchema.index({ status: 1, priority: -1, createdAt: -1 });
querySchema.index({ assignedAgentId: 1, status: 1 });
querySchema.index({ category: 1, status: 1 });
querySchema.index({ createdAt: -1 });

export const Query = (mongoose.models.Query || mongoose.model('Query', querySchema)) as Model<QueryDocument>;