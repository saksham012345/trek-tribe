import mongoose, { Schema, Document, Model } from 'mongoose';

export type MessageSender = 'user' | 'ai' | 'agent';
export type ChatStatus = 'active' | 'waiting-agent' | 'with-agent' | 'resolved' | 'closed';

interface ChatMessage {
  sender: MessageSender;
  message: string;
  timestamp: Date;
  isSystem?: boolean;
  agentId?: string;
  agentName?: string;
  confidence?: number; // AI confidence level
  intent?: string; // Detected user intent
  suggestions?: string[]; // Quick reply suggestions
}

interface UserContext {
  currentTrip?: string;
  recentBookings?: string[];
  preferences?: {
    destinations?: string[];
    budget?: number;
    travelStyle?: string;
  };
  issues?: string[];
}

export interface ChatSessionDocument extends Document {
  sessionId: string;
  userId?: string; // Optional for anonymous users
  userName?: string;
  userEmail?: string;
  
  status: ChatStatus;
  
  messages: ChatMessage[];
  
  // Context and metadata
  userContext: UserContext;
  currentIntent?: string;
  lastActivity: Date;
  
  // Agent handoff
  assignedAgentId?: string;
  handoffReason?: string;
  handoffTime?: Date;
  agentJoinedTime?: Date;
  
  // Analytics
  totalMessages: number;
  aiMessages: number;
  userMessages: number;
  agentMessages: number;
  averageResponseTime?: number;
  satisfactionRating?: number;
  
  // Session metadata
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema({
  sender: {
    type: String,
    enum: ['user', 'ai', 'agent'],
    required: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 2000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  agentId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  agentName: {
    type: String
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  intent: {
    type: String
  },
  suggestions: [{
    type: String
  }]
});

const chatSessionSchema = new Schema(
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
      index: true
    },
    userName: {
      type: String
    },
    userEmail: {
      type: String
    },
    
    status: {
      type: String,
      enum: ['active', 'waiting-agent', 'with-agent', 'resolved', 'closed'],
      default: 'active',
      index: true
    },
    
    messages: [chatMessageSchema],
    
    userContext: {
      currentTrip: {
        type: Schema.Types.ObjectId,
        ref: 'Trip'
      },
      recentBookings: [{
        type: String
      }],
      preferences: {
        destinations: [String],
        budget: Number,
        travelStyle: String
      },
      issues: [String]
    },
    
    currentIntent: {
      type: String
    },
    lastActivity: {
      type: Date,
      default: Date.now,
      index: true
    },
    
    assignedAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    handoffReason: {
      type: String
    },
    handoffTime: {
      type: Date
    },
    agentJoinedTime: {
      type: Date
    },
    
    totalMessages: {
      type: Number,
      default: 0
    },
    aiMessages: {
      type: Number,
      default: 0
    },
    userMessages: {
      type: Number,
      default: 0
    },
    agentMessages: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number
    },
    satisfactionRating: {
      type: Number,
      min: 1,
      max: 5
    },
    
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    referrer: {
      type: String
    }
  },
  { 
    timestamps: true 
  }
);

// Indexes for performance
chatSessionSchema.index({ status: 1, lastActivity: -1 });
chatSessionSchema.index({ assignedAgentId: 1, status: 1 });
chatSessionSchema.index({ userId: 1, createdAt: -1 });
chatSessionSchema.index({ createdAt: -1 });

// Auto-generate session ID
chatSessionSchema.pre('save', async function(next) {
  if (this.isNew && !this.sessionId) {
    this.sessionId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
  }
  
  // Update counters
  this.totalMessages = this.messages.length;
  this.aiMessages = this.messages.filter(m => m.sender === 'ai').length;
  this.userMessages = this.messages.filter(m => m.sender === 'user').length;
  this.agentMessages = this.messages.filter(m => m.sender === 'agent').length;
  
  // Update last activity
  if (this.messages.length > 0) {
    const latestMessage = this.messages[this.messages.length - 1];
    this.lastActivity = latestMessage.timestamp;
  }
  
  next();
});

// Auto-close inactive sessions (older than 24 hours)
chatSessionSchema.statics.closeInactiveSessions = async function() {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 24);
  
  return this.updateMany(
    {
      lastActivity: { $lt: cutoff },
      status: { $in: ['active', 'waiting-agent'] }
    },
    {
      status: 'closed'
    }
  );
};

export const ChatSession = (mongoose.models.ChatSession || mongoose.model('ChatSession', chatSessionSchema)) as Model<ChatSessionDocument>;