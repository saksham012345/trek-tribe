import mongoose, { Schema, Document, Model } from 'mongoose';

export type ChatMessageType = 'text' | 'image' | 'file' | 'location' | 'system';
export type ChatParticipantRole = 'user' | 'agent' | 'admin';
export type ChatStatus = 'active' | 'closed' | 'pending' | 'transferred';

interface ChatMessage {
  messageId: string;
  senderId: mongoose.Types.ObjectId;
  senderRole: ChatParticipantRole;
  type: ChatMessageType;
  content: string;
  metadata?: {
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    location?: {
      latitude: number;
      longitude: number;
      address?: string;
    };
    systemAction?: string;
  };
  timestamp: Date;
  readBy?: Array<{
    userId: mongoose.Types.ObjectId;
    readAt: Date;
  }>;
  edited?: {
    editedAt: Date;
    originalContent: string;
  };
}

export interface RealTimeChatDocument extends Document {
  roomId: string;
  userId: mongoose.Types.ObjectId;
  assignedAgentId?: mongoose.Types.ObjectId;
  relatedQueryId?: mongoose.Types.ObjectId;
  status: ChatStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject?: string;
  category?: string;
  messages: ChatMessage[];
  participants: Array<{
    userId: mongoose.Types.ObjectId;
    role: ChatParticipantRole;
    joinedAt: Date;
    leftAt?: Date;
    isOnline: boolean;
    lastSeen?: Date;
  }>;
  chatStartedAt: Date;
  firstResponseAt?: Date;
  lastMessageAt?: Date;
  chatClosedAt?: Date;
  closedBy?: mongoose.Types.ObjectId;
  closureReason?: string;
  satisfaction?: {
    rating: number;
    feedback?: string;
    submittedAt: Date;
  };
  tags?: string[];
  isTransferredFromBot: boolean;
  transferReason?: string;
  chatDuration?: number; // in seconds
  messageCount: number;
  avgResponseTime?: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema({
  messageId: { type: String, required: true, unique: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['user', 'agent', 'admin'], required: true },
  type: { type: String, enum: ['text', 'image', 'file', 'location', 'system'], default: 'text' },
  content: { type: String, required: true },
  metadata: {
    fileName: String,
    fileSize: Number,
    fileUrl: String,
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    systemAction: String
  },
  timestamp: { type: Date, default: Date.now },
  readBy: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  edited: {
    editedAt: Date,
    originalContent: String
  }
});

const realTimeChatSchema = new Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  assignedAgentId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  relatedQueryId: { type: Schema.Types.ObjectId, ref: 'Query' },
  status: { 
    type: String, 
    enum: ['active', 'closed', 'pending', 'transferred'], 
    default: 'pending',
    index: true 
  },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'urgent'], 
    default: 'medium',
    index: true 
  },
  subject: String,
  category: String,
  messages: [chatMessageSchema],
  participants: [{
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['user', 'agent', 'admin'], required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: Date,
    isOnline: { type: Boolean, default: false },
    lastSeen: Date
  }],
  chatStartedAt: { type: Date, default: Date.now },
  firstResponseAt: Date,
  lastMessageAt: { type: Date, default: Date.now },
  chatClosedAt: Date,
  closedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  closureReason: String,
  satisfaction: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    submittedAt: Date
  },
  tags: [String],
  isTransferredFromBot: { type: Boolean, default: false },
  transferReason: String,
  chatDuration: Number, // in seconds
  messageCount: { type: Number, default: 0 },
  avgResponseTime: Number, // in seconds
}, { timestamps: true });

// Indexes for performance
realTimeChatSchema.index({ status: 1, priority: -1 });
realTimeChatSchema.index({ assignedAgentId: 1, status: 1 });
realTimeChatSchema.index({ userId: 1, createdAt: -1 });
realTimeChatSchema.index({ lastMessageAt: -1 });

// Pre-save middleware to update message count and last message time
realTimeChatSchema.pre('save', function(next) {
  if (this.messages && this.messages.length > 0) {
    this.messageCount = this.messages.length;
    this.lastMessageAt = this.messages[this.messages.length - 1].timestamp;
  }
  next();
});

export const RealTimeChat = (mongoose.models.RealTimeChat || 
  mongoose.model('RealTimeChat', realTimeChatSchema)) as Model<RealTimeChatDocument>;