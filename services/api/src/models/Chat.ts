import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ChatMessage {
  senderId: string;
  senderType: 'user' | 'agent' | 'bot';
  content: string;
  timestamp: Date;
  isInternal?: boolean; // Internal notes visible only to agents
}

export interface ChatDocument extends Document {
  sessionId: string;
  userId?: string;
  assignedAgentId?: string;
  status: 'waiting' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  subject?: string;
  messages: ChatMessage[];
  escalatedAt?: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  rating?: number;
  feedback?: string;
  tags: string[];
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
    originalChatbotQuery?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema({
  senderId: { type: String, required: true },
  senderType: { 
    type: String, 
    enum: ['user', 'agent', 'bot'], 
    required: true 
  },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  isInternal: { type: Boolean, default: false }
});

const chatSchema = new Schema(
  {
    sessionId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: false,
      index: true
    },
    assignedAgentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: false,
      index: true
    },
    status: { 
      type: String, 
      enum: ['waiting', 'in_progress', 'resolved', 'closed'], 
      default: 'waiting',
      index: true
    },
    priority: { 
      type: String, 
      enum: ['low', 'medium', 'high', 'urgent'], 
      default: 'medium',
      index: true
    },
    category: { 
      type: String, 
      required: true,
      index: true
    },
    subject: { type: String },
    messages: [chatMessageSchema],
    escalatedAt: { type: Date },
    firstResponseAt: { type: Date },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String },
    tags: [{ type: String, index: true }],
    metadata: {
      userAgent: { type: String },
      ipAddress: { type: String },
      referrer: { type: String },
      originalChatbotQuery: { type: String }
    }
  },
  { timestamps: true }
);

// Indexes for performance
chatSchema.index({ status: 1, priority: -1, createdAt: -1 });
chatSchema.index({ assignedAgentId: 1, status: 1 });
chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ category: 1, status: 1 });

export const Chat = (mongoose.models.Chat || mongoose.model('Chat', chatSchema)) as Model<ChatDocument>;